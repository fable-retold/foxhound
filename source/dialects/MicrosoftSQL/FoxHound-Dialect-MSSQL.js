/**
* FoxHound MSSQL Dialect
*
* @license MIT
*
* For a MSSQL query override:
// An underscore template with the following values:
//      <%= DataElements %> = Field1, Field2, Field3, Field4
//      <%= Begin %>        = 0
//      <%= Cap %>          = 10
//      <%= Filter %>       = WHERE StartDate > :MyStartDate
//      <%= Sort %>         = ORDER BY Field1
// The values are empty strings if they aren't set.
*
* @author Steven Velozo <steven@velozo.com>
* @class FoxHoundDialectMSSQL
*/

var FoxHoundDialectMSSQL = function(pFable)
{
	//Request time from SQL server with microseconds resolution
	const SQL_NOW = "GETUTCDATE()";

	let _Fable = pFable;

	/**
	* Generate a table name from the scope
	*
	* @method: generateTableName
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Returns the table name clause
	*/
	var generateTableName = function(pParameters)
	{
		// Every Foxhound query has a table name; this puts it on here even if there are no columns
		// Which occurs when you generate a query like SELECT COUNT(*) FROM SomeTable;
		if (!pParameters.query.hasOwnProperty('parameterTypes'))
		{
			pParameters.query.parameterTypes = {};
		}
		return ' ['+pParameters.scope+']';
	};

	var generateMSSQLParameterTypeEntry = function(pParameters, pColumnParameterName, pColumn)
	{
		// Lazily create the parameterTypes object if it doesn't exist
		if (!pParameters.query.hasOwnProperty('parameterTypes'))
		{
			pParameters.query.parameterTypes = {};
		}
		// Find the column parameter type for our prepared statement
		let tmpColumnParameterTypeString = 'VarChar';
		if (typeof(pColumn) == 'object')
		{
			// See if it has a type, set the type string
			tmpColumnParameterTypeString = pColumn.Type;
		}
		else if (typeof(pColumn) == 'string')
		{
			var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
			for (let i = 0; i < tmpSchema.length; i++)
			{
				if (tmpSchema[i].Column == pColumn)
				{
					tmpColumnParameterTypeString = tmpSchema[i].Type;
					break;
				}
			}
		}
		else
		{
			_Fable.log.warn(`Meadow MSSQL query attempted to add a parameter type but no valid column schema entry object or column name was passed; parameter name ${pColumnParameterName}.`);
		}

		if ((tmpColumnParameterTypeString == null) || (tmpColumnParameterTypeString == undefined))
		{
			return false;
		}
		switch (tmpColumnParameterTypeString)
		{
			case 'AutoIdentity':
			case 'CreateIDUser':
			case 'UpdateIDUser':
			case 'DeleteIDUser':

			case 'Integer':
				pParameters.query.parameterTypes[pColumnParameterName] = 'Int';
				break;

			case 'Deleted':
			case 'Boolean':
				pParameters.query.parameterTypes[pColumnParameterName] = 'TinyInt';
				break;

			case 'Decimal':
				pParameters.query.parameterTypes[pColumnParameterName] = 'Decimal';
				break;

			case 'String':
			case 'AutoGUID':
				pParameters.query.parameterTypes[pColumnParameterName] = 'VarChar';
				break;

			case 'CreateDate':
			case 'UpdateDate':
			case 'DeleteDate':

			case 'DateTime':
				pParameters.query.parameterTypes[pColumnParameterName] = 'DateTime';
				break;

			default:
				// TODO: This might should throw?  It would mean a new type was added to stricture we don't know about.
				pParameters.query.parameterTypes[pColumnParameterName] = tmpColumnParameterTypeString;
				return false;
		}

		return true;
	}

	/**
	* Generate a field list from the array of dataElements
	*
	* Each entry in the dataElements is a simple string
	*
	* @method: generateFieldList
	* @param: {Object} pParameters SQL Query Parameters
	* @param {Boolean} pIsForCountClause (optional) If true, generate fields for use within a count clause.
	* @return: {String} Returns the field list clause, or empty string if explicit fields are requested but cannot be fulfilled
	*          due to missing schema.
	*/
	var generateFieldList = function(pParameters, pIsForCountClause)
	{
		var tmpDataElements = pParameters.dataElements;
		if (!Array.isArray(tmpDataElements) || tmpDataElements.length < 1)
		{
			const tmpTableName = generateTableName(pParameters);
			if (!pIsForCountClause)
			{
				return tmpTableName + '.*';
			}
			// we need to list all of the table fields explicitly; get them from the schema
			const tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
			if (tmpSchema.length < 1)
			{
				// this means we have no schema; returning an empty string here signals the calling code to handle this case
				return '';
			}
			const idColumn = tmpSchema.find((entry) => entry.Type === 'AutoIdentity');
			if (!idColumn)
			{
				// this means there is no autoincrementing unique ID column; treat as above
				return '';
			}
			const qualifiedIDColumn = `${idColumn.Column}`;
			return ` ${generateSafeFieldName(qualifiedIDColumn)}`;
		}

		var tmpFieldList = ' ';
		for (var i = 0; i < tmpDataElements.length; i++)
		{
			if (i > 0)
			{
				tmpFieldList += ', ';
			}
			if (Array.isArray(tmpDataElements[i]))
			{
				tmpFieldList += generateSafeFieldName(tmpDataElements[i][0]);
				if (tmpDataElements[i].length > 1 && tmpDataElements[i][1])
				{
					tmpFieldList += " AS " + generateSafeFieldName(tmpDataElements[i][1]);
				}
			}
			else
			{
				tmpFieldList += generateSafeFieldName(tmpDataElements[i]);
			}
		}
		return tmpFieldList;
	};

	/**
	* Generate a field list for the outer SELECT of the legacy pagination
	* wrapper.  The outer FROM is a subquery aliased as [_Paged], so the
	* default "[Table].*" qualifier can't resolve there — we need either
	* an explicit column list from the schema or a bare "*".
	*
	* If the caller set explicit dataElements, reuse them (they reference
	* bare column names, which work fine against the subquery alias).
	* Otherwise emit an explicit list from the schema to keep [_RowNum]
	* from leaking.  As a last resort, fall back to "*" — callers without
	* a schema will see [_RowNum] as an extra property on marshalled
	* records but the query itself remains valid.
	*
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Field list (prefixed with a single leading space)
	*/
	var generateOuterFieldListForLegacyPagination = function(pParameters)
	{
		var tmpDataElements = pParameters.dataElements;
		if (Array.isArray(tmpDataElements) && tmpDataElements.length > 0)
		{
			// Reuse the caller-supplied list.  It emits unqualified column
			// names ([Col], [Col] AS [Alias]) which resolve fine against
			// the subquery alias.
			return generateFieldList(pParameters);
		}

		var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
		if (tmpSchema.length > 0)
		{
			var tmpList = ' ';
			for (var i = 0; i < tmpSchema.length; i++)
			{
				if (i > 0) tmpList += ', ';
				tmpList += generateSafeFieldName(tmpSchema[i].Column);
			}
			return tmpList;
		}

		// No schema, no explicit dataElements — "*" is the best we can do.
		// [_RowNum] will surface on marshalled records; downstream code can
		// ignore it.  Schemas are the norm via Meadow so this is rare.
		return ' *';
	};

	/**
	* Ensure a field name is properly escaped.
	*/
	var generateSafeFieldName = function(pFieldName)
	{
		// This isn't great but best we can do for MS SQL needing brackets around field names for reserved keywords
		if ((pFieldName != '*') && (pFieldName.indexOf('[') < 0) && pFieldName.indexOf('.') < 0)
		{
			return '['+pFieldName+']';
		}
		else
		{
			return pFieldName;
		}
	}

	var resolveJsonColumnPath = function(pColumnName, pSchema)
	{
		if (!Array.isArray(pSchema) || pSchema.length < 1) return null;
		var tmpParts = pColumnName.replace(/`/g, '').replace(/"/g, '').split('.');
		for (var tmpStartIdx = 0; tmpStartIdx < Math.min(tmpParts.length - 1, 2); tmpStartIdx++)
		{
			var tmpBaseColumn = tmpParts[tmpStartIdx];
			for (var s = 0; s < pSchema.length; s++)
			{
				if (pSchema[s].Column === tmpBaseColumn &&
					(pSchema[s].Type === 'JSON' || pSchema[s].Type === 'JSONProxy'))
				{
					var tmpActualColumn = (pSchema[s].Type === 'JSONProxy') ? pSchema[s].StorageColumn : tmpBaseColumn;
					var tmpJsonPath = '$.' + tmpParts.slice(tmpStartIdx + 1).join('.');
					return { column: tmpActualColumn, path: tmpJsonPath };
				}
			}
		}
		return null;
	};

	/**
	* Generate a query from the array of where clauses
	*
	* Each clause is an object like:
		{
			Column:'Name',
			Operator:'EQ',
			Value:'John',
			Connector:'And',
			Parameter:'Name'
		}
	*
	* @method: generateWhere
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Returns the WHERE clause prefixed with WHERE, or an empty string if unnecessary
	*/
	var generateWhere = function(pParameters)
	{
		var tmpFilter = Array.isArray(pParameters.filter) ? pParameters.filter : [];
		var tmpTableName = generateTableName(pParameters);

		if (!pParameters.query.disableDeleteTracking)
		{
			// Check if there is a Deleted column on the Schema. If so, we add this to the filters automatically (if not already present)
			var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
			for (var i = 0; i < tmpSchema.length; i++)
			{
				// There is a schema entry for it.  Process it accordingly.
				var tmpSchemaEntry = tmpSchema[i];

				if (tmpSchemaEntry.Type === 'Deleted')
				{
					var tmpHasDeletedParameter = false;

					//first, check to see if filters are already looking for Deleted column
					if (tmpFilter.length > 0)
					{
						for (var x = 0; x < tmpFilter.length; x++)
						{
							if (tmpFilter[x].Column === tmpSchemaEntry.Column)
							{
								tmpHasDeletedParameter = true;
								break;
							}
						}
					}
					if (!tmpHasDeletedParameter)
					{
						//if not, we need to add it
						tmpFilter.push(
						{
							Column: tmpSchemaEntry.Column,
							Operator: '=',
							Value: 0,
							Connector: 'AND',
							Parameter: 'Deleted'
						});
					}
					break;
				}
			}
		}

		if (tmpFilter.length < 1)
		{
			return '';
		}

		var tmpWhere = ' WHERE';

		// This is used to disable the connectors for subsequent queries.
		// Only the open parenthesis operator uses this, currently.
		var tmpLastOperatorNoConnector = false;

		for (var i = 0; i < tmpFilter.length; i++)
		{
			if ((tmpFilter[i].Connector != 'NONE') && (tmpFilter[i].Operator != ')') && (tmpWhere != ' WHERE') && (tmpLastOperatorNoConnector == false))
			{
				tmpWhere += ' '+tmpFilter[i].Connector;
			}

			tmpLastOperatorNoConnector = false;

			var tmpColumnParameter;

			if (tmpFilter[i].Operator === '(')
			{
				// Open a logical grouping
				tmpWhere += ' (';
				tmpLastOperatorNoConnector = true;
			}
			else if (tmpFilter[i].Operator === ')')
			{
				// Close a logical grouping
				tmpWhere += ' )';
			}
			else if (tmpFilter[i].Operator === 'IN' || tmpFilter[i].Operator === "NOT IN")
			{
				tmpColumnParameter = tmpFilter[i].Parameter+'_w'+i;
				// Add the column name, operator and parameter name to the list of where value parenthetical
				tmpWhere += ' ['+tmpFilter[i].Column+'] '+tmpFilter[i].Operator+' ( @'+tmpColumnParameter+' )';
				pParameters.query.parameters[tmpColumnParameter] = tmpFilter[i].Value;
				// Find the column in the schema
				generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpFilter[i].Parameter)
			}
			else if (tmpFilter[i].Operator === 'IS NULL')
			{
				// IS NULL is a special operator which doesn't require a value, or parameter
				tmpWhere += ' ['+tmpFilter[i].Column+'] '+tmpFilter[i].Operator;
			}
			else if (tmpFilter[i].Operator === 'IS NOT NULL')
			{
				// IS NOT NULL is a special operator which doesn't require a value, or parameter
				tmpWhere += ' ['+tmpFilter[i].Column+'] '+tmpFilter[i].Operator;
			}
			else
			{
				tmpColumnParameter = tmpFilter[i].Parameter+'_w'+i;
				var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
				var tmpJsonRef = resolveJsonColumnPath(tmpFilter[i].Column, tmpSchema);
				if (tmpJsonRef)
				{
					tmpWhere += ' JSON_VALUE(['+tmpJsonRef.column+"], '"+tmpJsonRef.path+"') "+tmpFilter[i].Operator+' :'+tmpColumnParameter;
				}
				else
				{
					tmpWhere += ' ['+tmpFilter[i].Column+'] '+tmpFilter[i].Operator+' @'+tmpColumnParameter;
				}
				pParameters.query.parameters[tmpColumnParameter] = tmpFilter[i].Value;
				generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpFilter[i].Parameter)
			}
		}

		return tmpWhere;
	};

	/**
	* Find the column whose value the database generates on INSERT.
	*
	* Ordering asks a different question; see findIdentityColumn.
	*
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String|null} The column name, or null if none found
	*/
	var findPrimaryKeyColumn = function(pParameters)
	{
		var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
		for (var i = 0; i < tmpSchema.length; i++)
		{
			if (tmpSchema[i].Type === 'AutoIdentity')
			{
				return tmpSchema[i].Column;
			}
		}
		return null;
	};

	/**
	* Find the column that gives a read a total order.
	*
	* An AutoIdentity schema entry is preferred because it is known to exist on
	* the table.  `defaultIdentifier` is meadow's DefaultIdentifier, which is
	* correct for primary keys that aren't auto-increment — but it falls back to
	* 'ID'+Scope when nothing set it, so it is only trusted when the schema
	* confirms the column is real.
	*
	* @method: findIdentityColumn
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String|null} The column name, or null if none can be resolved
	*/
	var findIdentityColumn = function(pParameters)
	{
		var tmpQuery = (pParameters.query && typeof(pParameters.query) === 'object') ? pParameters.query : {};
		var tmpSchema = Array.isArray(tmpQuery.schema) ? tmpQuery.schema : [];

		for (var i = 0; i < tmpSchema.length; i++)
		{
			if (tmpSchema[i].Type === 'AutoIdentity')
			{
				return tmpSchema[i].Column;
			}
		}

		if (typeof(tmpQuery.defaultIdentifier) === 'string' && tmpQuery.defaultIdentifier)
		{
			for (var j = 0; j < tmpSchema.length; j++)
			{
				if (tmpSchema[j].Column === tmpQuery.defaultIdentifier)
				{
					return tmpQuery.defaultIdentifier;
				}
			}
		}

		return null;
	};

	/**
	* Resolve the sort a capped read should actually run with.
	*
	* Paging over a sort that isn't a total order has no defined behavior: pages
	* can overlap and drop rows.  Appending the identity column makes the order
	* total, so pages partition the result set.  A caller-supplied sort still
	* leads; the identity column only breaks ties.
	*
	* The ORDER BY clause is emitted unqualified here, so a joined read gets no
	* scope prefix — an ambiguous-column error is preferable to the silently
	* wrong `[Animal.IDAnimal]` this dialect's bracket quoting would produce.
	*
	* @method: resolveStableSort
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {Array} The sort array to emit
	*/
	var resolveStableSort = function(pParameters)
	{
		var tmpSort = Array.isArray(pParameters.sort) ? pParameters.sort.slice() : [];

		// Only paged reads need a total order.  DISTINCT rejects an ORDER BY
		// term that isn't in the select list, and a query override owns its own
		// clause placement (it may be grouping), so neither can take one.
		if (!pParameters.cap || pParameters.distinct || pParameters.queryOverride || pParameters.disableStableSort)
		{
			return tmpSort;
		}

		var tmpIdentityColumn = findIdentityColumn(pParameters);
		if (!tmpIdentityColumn)
		{
			return tmpSort;
		}

		for (var i = 0; i < tmpSort.length; i++)
		{
			if (String(tmpSort[i].Column).split('.').pop() === tmpIdentityColumn)
			{
				// Already a total order.
				return tmpSort;
			}
		}

		tmpSort.push({ Column: tmpIdentityColumn, Direction: 'Ascending' });
		return tmpSort;
	};

	/**
	* Generate an ORDER BY clause from the sort array
	*
	* Each entry in the sort is an object like:
	* {Column:'Color',Direction:'Descending'}
	*
	* A capped read has the identity column appended as a final tiebreaker so
	* paging is deterministic.  MSSQL pagination (both OFFSET/FETCH and
	* ROW_NUMBER) also *requires* an ORDER BY or it is a syntax error, so when
	* no sort survives resolution we fall back to `ORDER BY (SELECT 1)` — legal
	* for OFFSET/FETCH but not for ROW_NUMBER (the legacy pagination path
	* handles that case by refusing to paginate).
	*
	* @method: generateOrderBy
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Returns the field list clause
	*/
	var generateOrderBy = function(pParameters)
	{
		var tmpOrderBy = resolveStableSort(pParameters);
		if (!Array.isArray(tmpOrderBy) || tmpOrderBy.length < 1)
		{
			if (pParameters.cap)
			{
				return ' ORDER BY (SELECT 1)';
			}
			return '';
		}

		var tmpOrderClause = ' ORDER BY';
		for (var i = 0; i < tmpOrderBy.length; i++)
		{
			if (i > 0)
			{
				tmpOrderClause += ',';
			}
			tmpOrderClause += ' ['+tmpOrderBy[i].Column+']';

			if (tmpOrderBy[i].Direction == 'Descending')
			{
				tmpOrderClause += ' DESC';
			}
		}
		return tmpOrderClause;
	};

	/**
	* Generate the limit clause
	*
	* When `legacyPagination` is set on pParameters the limit is emitted
	* by the Read function using a ROW_NUMBER() subquery wrapper instead
	* (OFFSET/FETCH NEXT requires SQL Server 2012+ / compatibility level
	* 110+, which some customers don't have).  In that case this function
	* returns an empty string.
	*
	* @method: generateLimit
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Returns the table limit clause
	*/
	var generateLimit = function(pParameters)
	{
		if (!pParameters.cap)
		{
			return '';
		}

		if (pParameters.legacyPagination)
		{
			// The Read function wraps the query in a ROW_NUMBER() subquery
			// instead of appending an OFFSET/FETCH tail clause.
			return '';
		}

		var tmpLimit = ' OFFSET ';
		// If there is a begin record, we'll pass that in as well.
		if (pParameters.begin !== false)
		{
			tmpLimit += pParameters.begin;
		}
		else
		{
			tmpLimit += '0';
		}
		// Cap is required for a limit clause.
		tmpLimit +=  ` ROWS FETCH NEXT ${pParameters.cap} ROWS ONLY`;

		return tmpLimit;
	};

	/**
	* Generate the an index hinting clause
	*
	* @method: generateIndexHints
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Returns the table index hint clause
	*/
	var generateIndexHints = function(pParameters)
	{
		if (!Array.isArray(pParameters.indexHints) || pParameters.indexHints.length < 1)
		{
			return '';
		}

		return ` WITH(INDEX(${pParameters.indexHints.join(',')}))`
	};

	/**
	* Generate the join clause
	*
	* @method: generateJoins
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Returns the join clause
	*/
	var generateJoins = function(pParameters)
	{
		var tmpJoins = pParameters.join;
		if (!Array.isArray(tmpJoins) || tmpJoins.length < 1)
		{
			return '';
		}

		var tmpJoinClause = ''; //ex. ' INNER JOIN';
		for (var i = 0; i < tmpJoins.length; i++)
		{
			var join = tmpJoins[i];
			//verify that all required fields are valid
			if (join.Type && join.Table && join.From && join.To)
			{
				tmpJoinClause += ` ${join.Type} [${join.Table}] ON ${join.From} = ${join.To}`;
			}
		}

		return tmpJoinClause;
	}

	/**
	* Generate the update SET clause
	*
	* @method: generateUpdateSetters
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Returns the table name clause
	*/
	var generateUpdateSetters = function(pParameters)
	{
		var tmpRecords = pParameters.query.records;
		// We need to tell the query not to generate improperly if there are no values to set.
		if (!Array.isArray(tmpRecords) || tmpRecords.length < 1)
		{
			return false;
		}

		// Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
		var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];

		var tmpUpdate = '';
		// If there is more than one record in records, we are going to ignore them for now.
		var tmpCurrentColumn = 0;
		for(var tmpColumn in tmpRecords[0])
		{
			// No hash table yet, so, we will just linear search it for now.
			// This uses the schema to decide if we want to treat a column differently on insert
			var tmpSchemaEntry = {Column:tmpColumn, Type:'Default'};
			for (var i = 0; i < tmpSchema.length; i++)
			{
				if (tmpColumn == tmpSchema[i].Column)
				{
					// There is a schema entry for it.  Process it accordingly.
					tmpSchemaEntry = tmpSchema[i];
					break;
				}
			}

			// if (pParameters.query.disableAutoDateStamp &&
			// 	tmpSchemaEntry.Type === 'UpdateDate')
			// {
			// 	// This is ignored if flag is set
			// 	continue;
			// }
			if (pParameters.query.disableAutoUserStamp &&
				tmpSchemaEntry.Type === 'UpdateIDUser')
			{
				// This is ignored if flag is set
				continue;
			}

			switch (tmpSchemaEntry.Type)
			{
				case 'AutoIdentity':
				case 'CreateDate':
				case 'CreateIDUser':
				case 'DeleteDate':
				case 'DeleteIDUser':
					// These are all ignored on update
					continue;
			}
			if (tmpCurrentColumn > 0)
			{
				tmpUpdate += ',';
			}
			switch (tmpSchemaEntry.Type)
			{
				case 'UpdateDate':
					// This is an autoidentity, so we don't parameterize it and just pass in NULL
					if (pParameters.query.disableAutoDateStamp)
					{
						var tmpColumnParameter = 'MANUAL_UpdateDate'
						tmpUpdate += ' ['+tmpColumn+'] = @MANUAL_UpdateDate';
						pParameters.query.parameters[tmpColumnParameter] = tmpRecords[0][tmpColumn];
						generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
					}
					else
					{
						tmpUpdate += ' ['+tmpColumn+'] = ' + SQL_NOW;
					}
					break;
				case 'UpdateIDUser':
					// This is the user ID, which we hope is in the query.
					// This is how to deal with a normal column
					var tmpColumnParameter = tmpColumn+'_'+tmpCurrentColumn;
					tmpUpdate += ' ['+tmpColumn+'] = @'+tmpColumnParameter;
					// Set the query parameter
					pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
					generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpColumn)
					break;
				case 'JSON':
					var tmpJSONUpdateParam = tmpColumn+'_'+tmpCurrentColumn;
					tmpUpdate += ' ['+tmpColumn+'] = @'+tmpJSONUpdateParam;
					pParameters.query.parameters[tmpJSONUpdateParam] = (typeof tmpRecords[0][tmpColumn] === 'string')
						? tmpRecords[0][tmpColumn]
						: JSON.stringify(tmpRecords[0][tmpColumn] || {});
					generateMSSQLParameterTypeEntry(pParameters, tmpJSONUpdateParam, {Type:'String'});
					break;
				case 'JSONProxy':
					var tmpProxyUpdateParam = tmpSchemaEntry.StorageColumn+'_'+tmpCurrentColumn;
					tmpUpdate += ' ['+tmpSchemaEntry.StorageColumn+'] = @'+tmpProxyUpdateParam;
					pParameters.query.parameters[tmpProxyUpdateParam] = (typeof tmpRecords[0][tmpColumn] === 'string')
						? tmpRecords[0][tmpColumn]
						: JSON.stringify(tmpRecords[0][tmpColumn] || {});
					generateMSSQLParameterTypeEntry(pParameters, tmpProxyUpdateParam, {Type:'String'});
					break;
				default:
					var tmpColumnDefaultParameter = tmpColumn+'_'+tmpCurrentColumn;
					tmpUpdate += ' ['+tmpColumn+'] = @'+tmpColumnDefaultParameter;

					// Set the query parameter
					pParameters.query.parameters[tmpColumnDefaultParameter] = tmpRecords[0][tmpColumn];
					generateMSSQLParameterTypeEntry(pParameters, tmpColumnDefaultParameter, tmpSchemaEntry)
					break;
			}

			// We use a number to make sure parameters are unique.
			tmpCurrentColumn++;
		}

		// We need to tell the query not to generate improperly if there are no values set.
		if (tmpUpdate === '')
		{
			return false;
		}

		return tmpUpdate;
	};

	/**
	* Generate the update-delete SET clause
	*
	* @method: generateUpdateDeleteSetters
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Returns the table name clause
	*/
	var generateUpdateDeleteSetters = function(pParameters)
	{
		if (pParameters.query.disableDeleteTracking)
		{
			//Don't generate an UPDATE query if Delete tracking is disabled
			return false;
		}
		// Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
		var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];

		var tmpCurrentColumn = 0;
		var tmpHasDeletedField = false;
		var tmpUpdate = '';
		// No hash table yet, so, we will just linear search it for now.
		// This uses the schema to decide if we want to treat a column differently on insert
		var tmpSchemaEntry = {Type:'Default'};
		for (var i = 0; i < tmpSchema.length; i++)
		{
			// There is a schema entry for it.  Process it accordingly.
			tmpSchemaEntry = tmpSchema[i];

			var tmpUpdateSql = null;

			switch (tmpSchemaEntry.Type)
			{
				case 'Deleted':
					tmpUpdateSql = ' ['+tmpSchemaEntry.Column+'] = 1';
					tmpHasDeletedField = true; //this field is required in order for query to be built
					break;
				case 'DeleteDate':
					tmpUpdateSql = ' ['+tmpSchemaEntry.Column+'] = ' + SQL_NOW;
					break;
				case 'UpdateDate':
					// Delete operation is an Update, so we should stamp the update time
					tmpUpdateSql = ' ['+tmpSchemaEntry.Column+'] = ' + SQL_NOW;
					break;
				case 'DeleteIDUser':
					// This is the user ID, which we hope is in the query.
					// This is how to deal with a normal column
					var tmpColumnParameter = tmpSchemaEntry.Column+'_'+tmpCurrentColumn;
					tmpUpdateSql = ' ['+tmpSchemaEntry.Column+'] = @'+tmpColumnParameter;
					// Set the query parameter
					pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
					generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry)
					break;
				default:
					//DON'T allow update of other fields in this query
					continue;
			}

			if (tmpCurrentColumn > 0)
			{
				tmpUpdate += ',';
			}

			tmpUpdate += tmpUpdateSql;

			// We use a number to make sure parameters are unique.
			tmpCurrentColumn++;
		}

		// We need to tell the query not to generate improperly if there are no values set.
		if (!tmpHasDeletedField ||
			tmpUpdate === '')
		{
			return false;
		}

		return tmpUpdate;
	};

	/**
	* Generate the update-undelete SET clause
	*
	* @method: generateUpdateUndeleteSetters
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Returns the table name clause
	*/
	var generateUpdateUndeleteSetters = function(pParameters)
	{
		// Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
		var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];

		var tmpCurrentColumn = 0;
		var tmpHasDeletedField = false;
		var tmpUpdate = '';
		// No hash table yet, so, we will just linear search it for now.
		// This uses the schema to decide if we want to treat a column differently on insert
		var tmpSchemaEntry = {Type:'Default'};
		for (var i = 0; i < tmpSchema.length; i++)
		{
			// There is a schema entry for it.  Process it accordingly.
			tmpSchemaEntry = tmpSchema[i];

			var tmpUpdateSql = null;

			switch (tmpSchemaEntry.Type)
			{
				case 'Deleted':
					tmpUpdateSql = ' ['+tmpSchemaEntry.Column+'] = 0';
					tmpHasDeletedField = true; //this field is required in order for query to be built
					break;
				case 'UpdateDate':
					// The undelete operation is an Update, so we should stamp the update time
					tmpUpdateSql = ' ['+tmpSchemaEntry.Column+'] = ' + SQL_NOW;
					break;
				case 'UpdateIDUser':
					var tmpColumnParameter = tmpSchemaEntry.Column+'_'+tmpCurrentColumn;
					tmpUpdateSql = ' ['+tmpSchemaEntry.Column+'] = @'+tmpColumnParameter;
					pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
					generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry)
					break;
				default:
					//DON'T allow update of other fields in this query
					continue;
			}

			if (tmpCurrentColumn > 0)
			{
				tmpUpdate += ',';
			}

			tmpUpdate += tmpUpdateSql;

			// We use a number to make sure parameters are unique.
			tmpCurrentColumn++;
		}

		// We need to tell the query not to generate improperly if there are no values set.
		if (!tmpHasDeletedField ||
			tmpUpdate === '')
		{
			return false;
		}

		return tmpUpdate;
	};

	/**
	* Generate the create SET clause
	*
	* @method: generateCreateSetList
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Returns the table name clause
	*/
	var generateCreateSetValues = function(pParameters)
	{
		var tmpRecords = pParameters.query.records;
		// We need to tell the query not to generate improperly if there are no values to set.
		if (!Array.isArray(tmpRecords) || tmpRecords.length < 1)
		{
			return false;
		}

		// Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
		var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];


		var tmpCreateSet = '';
		// If there is more than one record in records, we are going to ignore them for now.
		var tmpCurrentColumn = 0;
		for(var tmpColumn in tmpRecords[0])
		{
			// No hash table yet, so, we will just linear search it for now.
			// This uses the schema to decide if we want to treat a column differently on insert
			var tmpSchemaEntry = {Column:tmpColumn, Type:'Default'};
			for (var i = 0; i < tmpSchema.length; i++)
			{
				if (tmpColumn == tmpSchema[i].Column)
				{
					// There is a schema entry for it.  Process it accordingly.
					tmpSchemaEntry = tmpSchema[i];
					break;
				}
			}

			if (!pParameters.query.disableDeleteTracking)
			{
				if (tmpSchemaEntry.Type === 'DeleteDate' ||
					tmpSchemaEntry.Type === 'DeleteIDUser')
				{
					// These are all ignored on insert (if delete tracking is enabled as normal)
					continue;
				}
			}

			if ((tmpCurrentColumn > 0) && (tmpCreateSet != ''))
			{
				tmpCreateSet += ',';
			}

			//define a re-usable method for setting up field definitions in a default pattern
			var buildDefaultDefinition = function()
			{
				var tmpColumnParameter = tmpColumn+'_'+tmpCurrentColumn;
				tmpCreateSet += ' @'+tmpColumnParameter;
				// Set the query parameter
				pParameters.query.parameters[tmpColumnParameter] = tmpRecords[0][tmpColumn];
				generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry)
			};

			var tmpColumnParameter;
			switch (tmpSchemaEntry.Type)
			{
				case 'AutoIdentity':
					if (pParameters.query.disableAutoIdentity)
					{
						buildDefaultDefinition();
					}
					else
					{
						// This is an autoidentity, so we don't parameterize it and just pass in NULL
						//tmpCreateSet += ' NULL';
						// For MSSQL we have to skip this.  NULL and DEFAULT both error for autoidentities.
					}
					break;
				case 'AutoGUID':
					if (pParameters.query.disableAutoIdentity)
					{
						buildDefaultDefinition();
					}
					else if (tmpRecords[0][tmpColumn] &&
							tmpRecords[0][tmpColumn].length >= 5 &&
							tmpRecords[0][tmpColumn] !== '0x0000000000000000') //stricture default
					{
						// Allow consumer to override AutoGUID
						buildDefaultDefinition();
					}
					else
					{
						// This is an autoidentity, so we don't parameterize it and just pass in NULL
						tmpColumnParameter = tmpColumn+'_'+tmpCurrentColumn;
						tmpCreateSet += ' @'+tmpColumnParameter;
						// Set the query parameter
						pParameters.query.parameters[tmpColumnParameter] = pParameters.query.UUID;
						generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry)
					}
					break;
				case 'UpdateDate':
				case 'CreateDate':
				case 'DeleteDate':
					if (pParameters.query.disableAutoDateStamp)
					{
						buildDefaultDefinition();
					}
					else
					{
						// This is an autoidentity, so we don't parameterize it and just pass in NULL
						tmpCreateSet += ' ' + SQL_NOW;
					}
					break;
				case 'DeleteIDUser':
				case 'UpdateIDUser':
				case 'CreateIDUser':
					if (pParameters.query.disableAutoUserStamp)
					{
						buildDefaultDefinition();
					}
					else
					{
						// This is the user ID, which we hope is in the query.
						// This is how to deal with a normal column
						tmpColumnParameter = tmpColumn+'_'+tmpCurrentColumn;
						tmpCreateSet += ' @'+tmpColumnParameter;
						// Set the query parameter
						pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
						generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry)
					}
					break;
				case 'JSON':
					var tmpJSONCreateParam = tmpColumn+'_'+tmpCurrentColumn;
					tmpCreateSet += ' @'+tmpJSONCreateParam;
					pParameters.query.parameters[tmpJSONCreateParam] = (typeof tmpRecords[0][tmpColumn] === 'string')
						? tmpRecords[0][tmpColumn]
						: JSON.stringify(tmpRecords[0][tmpColumn] || {});
					generateMSSQLParameterTypeEntry(pParameters, tmpJSONCreateParam, {Type:'String'});
					break;
				case 'JSONProxy':
					var tmpProxyCreateParam = tmpColumn+'_'+tmpCurrentColumn;
					tmpCreateSet += ' @'+tmpProxyCreateParam;
					pParameters.query.parameters[tmpProxyCreateParam] = (typeof tmpRecords[0][tmpColumn] === 'string')
						? tmpRecords[0][tmpColumn]
						: JSON.stringify(tmpRecords[0][tmpColumn] || {});
					generateMSSQLParameterTypeEntry(pParameters, tmpProxyCreateParam, {Type:'String'});
					break;
				default:
					buildDefaultDefinition();
					break;
			}

			// We use an appended number to make sure parameters are unique.
			tmpCurrentColumn++;
		}

		// We need to tell the query not to generate improperly if there are no values set.
		if (tmpCreateSet === '')
		{
			return false;
		}

		return tmpCreateSet;
	};

	/**
	* Generate the create SET clause
	*
	* @method: generateCreateSetList
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Returns the table name clause
	*/
	var generateCreateSetList = function(pParameters)
	{
		// The records were already validated by generateCreateSetValues
		var tmpRecords = pParameters.query.records;

		// Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
		var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];

		var tmpCreateSet = '';
		// If there is more than one record in records, we are going to ignore them for now.
		for(var tmpColumn in tmpRecords[0])
		{
			// No hash table yet, so, we will just linear search it for now.
			// This uses the schema to decide if we want to treat a column differently on insert
			var tmpSchemaEntry = {Column:tmpColumn, Type:'Default'};
			for (var i = 0; i < tmpSchema.length; i++)
			{
				if (tmpColumn == tmpSchema[i].Column)
				{
					// There is a schema entry for it.  Process it accordingly.
					tmpSchemaEntry = tmpSchema[i];
					break;
				}
			}
			if (!pParameters.query.disableDeleteTracking)
			{
				if (tmpSchemaEntry.Type === 'DeleteDate' ||
					tmpSchemaEntry.Type === 'DeleteIDUser')
				{
					// These are all ignored on insert (if delete tracking is enabled as normal)
					continue;
				}
			}
			switch (tmpSchemaEntry.Type)
			{
				// We skip these for MSSQL on INSERT or they cause an error for some versions (different errors for different versions)
				case 'AutoIdentity':
					if (pParameters.query.disableAutoIdentity)
					{
						if (tmpCreateSet != '')
						{
							tmpCreateSet += ',';
						}
						tmpCreateSet += ' ['+tmpColumn+']';
					}
					continue;
				case 'JSON':
					if (tmpCreateSet != '')
					{
						tmpCreateSet += ',';
					}
					tmpCreateSet += ' ['+tmpColumn+']';
					break;
				case 'JSONProxy':
					if (tmpCreateSet != '')
					{
						tmpCreateSet += ',';
					}
					tmpCreateSet += ' ['+tmpSchemaEntry.StorageColumn+']';
					break;
				default:
					if (tmpCreateSet != '')
					{
						tmpCreateSet += ',';
					}
					tmpCreateSet += ' ['+tmpColumn+']';
					break;
			}
		}

		return tmpCreateSet;
	};


	var Create = function(pParameters)
	{
		var tmpTableName = generateTableName(pParameters);
		var tmpCreateSetList = generateCreateSetList(pParameters);
		var tmpCreateSetValues = generateCreateSetValues(pParameters);

		if (!tmpCreateSetValues)
		{
			return false;
		}

		return 'INSERT INTO'+tmpTableName+' ('+tmpCreateSetList+') VALUES ('+tmpCreateSetValues+');';
	};


	/**
	* Read one or many records
	*
	* Some examples:
	* SELECT * FROM WIDGETS;
	* SELECT * FROM WIDGETS LIMIT 0, 20;
	* SELECT * FROM WIDGETS LIMIT 5, 20;
	* SELECT ID, Name, Cost FROM WIDGETS LIMIT 5, 20;
	* SELECT ID, Name, Cost FROM WIDGETS LIMIT 5, 20 WHERE LastName = 'Smith';
	*
	* @method Read
	* @param {Object} pParameters SQL Query parameters
	* @return {String} Returns the current Query for chaining.
	*/
	var Read = function(pParameters)
	{
		var tmpFieldList = generateFieldList(pParameters);
		var tmpTableName = generateTableName(pParameters);
		var tmpWhere = generateWhere(pParameters);
		var tmpJoin = generateJoins(pParameters);
		var tmpOrderBy = generateOrderBy(pParameters);
		var tmpLimit = generateLimit(pParameters);
		var tmpIndexHints = generateIndexHints(pParameters);
		const tmpOptDistinct = pParameters.distinct ? ' DISTINCT' : '';

		if (pParameters.queryOverride)
		{
			try
			{
				var tmpQueryTemplate = _Fable.Utility.template(pParameters.queryOverride);
				return tmpQueryTemplate({FieldList:tmpFieldList, TableName:tmpTableName, Where:tmpWhere, Join:tmpJoin, OrderBy:tmpOrderBy, Limit:tmpLimit, IndexHints: tmpIndexHints, Distinct: tmpOptDistinct, _Params: pParameters});
			}
			catch (pError)
			{
				// This pokemon is here to give us a convenient way of not throwing up totally if the query fails.
				console.log('Error with custom Read Query ['+pParameters.queryOverride+']: '+pError);
				return false;
			}
		}

		// Legacy pagination path — emit a ROW_NUMBER() wrapper instead of
		// OFFSET/FETCH.  Required for SQL Server 2008 R2 and earlier, or
		// for databases running at a compatibility level below 110 (2012).
		// Enabled via pParameters.legacyPagination (forwarded from the
		// meadow-connection-mssql provider's LegacyPagination config).
		if (pParameters.legacyPagination && pParameters.cap)
		{
			var tmpBegin = (pParameters.begin !== false) ? pParameters.begin : 0;
			var tmpEnd = tmpBegin + pParameters.cap;
			// generateOrderBy always returns a usable ORDER BY when cap is
			// set.  ROW_NUMBER()'s OVER() clause takes the same body but
			// without the leading space.
			var tmpOverClause = tmpOrderBy.replace(/^ /, '');
			// The outer SELECT's FROM is the subquery alias, not the base
			// table — so the default field list's "[Table].*" qualifier
			// won't resolve at the outer level.  Compute an outer field
			// list that works regardless of whether the caller supplied
			// explicit dataElements or relied on the default.
			var tmpOuterFieldList = generateOuterFieldListForLegacyPagination(pParameters);
			// INDEX hints and JOINs live on the inner select (they apply
			// to the base table).  [_RowNum] is confined to the subquery.
			return `SELECT${tmpOptDistinct}${tmpOuterFieldList} FROM (SELECT${tmpFieldList}, ROW_NUMBER() OVER (${tmpOverClause}) AS [_RowNum] FROM${tmpTableName}${tmpIndexHints}${tmpJoin}${tmpWhere}) AS [_Paged] WHERE [_RowNum] > ${tmpBegin} AND [_RowNum] <= ${tmpEnd};`;
		}

		return `SELECT${tmpOptDistinct}${tmpFieldList} FROM${tmpTableName}${tmpIndexHints}${tmpJoin}${tmpWhere}${tmpOrderBy}${tmpLimit};`;
	};

	var Update = function(pParameters)
	{
		var tmpTableName = generateTableName(pParameters);
		var tmpWhere = generateWhere(pParameters);
		var tmpUpdateSetters = generateUpdateSetters(pParameters);

		if (!tmpUpdateSetters)
		{
			return false;
		}

		return 'UPDATE'+tmpTableName+' SET'+tmpUpdateSetters+tmpWhere+';';
	};

	var Delete = function(pParameters)
	{
		var tmpTableName = generateTableName(pParameters);
		var tmpWhere = generateWhere(pParameters);
		var tmpUpdateDeleteSetters = generateUpdateDeleteSetters(pParameters);

		if (tmpUpdateDeleteSetters)
		{
			//If it has a deleted bit, update it instead of actually deleting the record
			return 'UPDATE'+tmpTableName+' SET'+tmpUpdateDeleteSetters+tmpWhere+';';
		}
		else
		{
			return 'DELETE FROM'+tmpTableName+tmpWhere+';';
		}
	};

	var Undelete = function(pParameters)
	{
		var tmpTableName = generateTableName(pParameters);
		// TODO: Fix these
		let tmpDeleteTrackingState = pParameters.query.disableDeleteTracking;
		pParameters.query.disableDeleteTracking = true;
		var tmpWhere = generateWhere(pParameters);
		var tmpUpdateUndeleteSetters = generateUpdateUndeleteSetters(pParameters);
		pParameters.query.disableDeleteTracking = tmpDeleteTrackingState;

		if (tmpUpdateUndeleteSetters)
		{
			//If the table has a deleted bit, go forward with the update to change things.
			return 'UPDATE'+tmpTableName+' SET'+tmpUpdateUndeleteSetters+tmpWhere+';';
		}
		else
		{
			// This is a no-op because the record can't be undeleted.
			// TODO: Should it throw instead?
			return 'SELECT NULL;';
		}
	};

	var Count = function(pParameters)
	{
		var tmpFieldList = pParameters.distinct ? generateFieldList(pParameters, true) : '*';
		var tmpTableName = generateTableName(pParameters);
		var tmpJoin = generateJoins(pParameters);
		var tmpWhere = generateWhere(pParameters);
		var tmpIndexHints = generateIndexHints(pParameters);
		// here, we ignore the distinct keyword if no fields have been specified and
		if (pParameters.distinct && tmpFieldList.length < 1)
		{
			console.warn('Distinct requested but no field list or schema are available, so not honoring distinct for count query.');
		}
		const tmpOptDistinct = pParameters.distinct && tmpFieldList.length > 0 ? 'DISTINCT' : '';

		if (pParameters.queryOverride)
		{
			try
			{
				var tmpQueryTemplate = _Fable.Utility.template(pParameters.queryOverride);
				return tmpQueryTemplate({FieldList:[], TableName:tmpTableName, Where:tmpWhere, OrderBy:'', IndexHints: tmpIndexHints, Limit:'', Distinct: tmpOptDistinct, _Params: pParameters});
			}
			catch (pError)
			{
				// This pokemon is here to give us a convenient way of not throwing up totally if the query fails.
				console.log('Error with custom Count Query ['+pParameters.queryOverride+']: '+pError);
				return false;
			}
		}

		return `SELECT COUNT(${tmpOptDistinct}${tmpFieldList || '*'}) AS Row_Count FROM${tmpTableName}${tmpIndexHints}${tmpJoin}${tmpWhere};`;
	};

	var tmpDialect = ({
		Create: Create,
		Read: Read,
		Update: Update,
		Delete: Delete,
		Undelete: Undelete,
		Count: Count
	});

	/**
	* Dialect Name
	*
	* @property name
	* @type string
	*/
	Object.defineProperty(tmpDialect, 'name',
		{
			get: function() { return 'MSSQL'; },
			enumerable: true
		});

	return tmpDialect;
};

module.exports = FoxHoundDialectMSSQL;
