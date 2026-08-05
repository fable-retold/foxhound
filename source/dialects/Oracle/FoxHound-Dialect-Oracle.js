/**
* FoxHound Oracle Dialect
*
* @license MIT
*
* For an Oracle query override:
// An underscore template with the following values:
//      <%= DataElements %> = Field1, Field2, Field3, Field4
//      <%= Begin %>        = 0
//      <%= Cap %>          = 10
//      <%= Filter %>       = WHERE StartDate > :MyStartDate
//      <%= Sort %>         = ORDER BY Field1
// The values are empty strings if they aren't set.
*
* Oracle notes:
*   - Identifiers are emitted unquoted by default (Oracle folds them to
*     UPPERCASE).  Set pParameters.quoteIdentifiers to wrap them in double
*     quotes and preserve the original PascalCase (case-sensitive matching).
*   - Bind parameters use the :name style consumed natively by oracledb.
*   - Pagination uses the 12c+ OFFSET/FETCH clause by default and a
*     ROWNUM double-subquery wrapper when pParameters.legacyPagination is set
*     (for 11g and earlier, which have no OFFSET/FETCH).
*   - INSERT appends a RETURNING <IDColumn> INTO :RETURNING_ID clause when the
*     table has an AutoIdentity column (Oracle has no SCOPE_IDENTITY()).
*   - Generated statements carry no trailing semicolon — oracledb rejects the
*     terminator on non-PL/SQL statements.
*
* @author Steven Velozo <steven@velozo.com>
* @class FoxHoundDialectOracle
*/

var FoxHoundDialectOracle = function(pFable)
{
	// True UTC timestamp regardless of the database server's session time zone.
	const SQL_NOW = "SYS_EXTRACT_UTC(SYSTIMESTAMP)";

	let _Fable = pFable;

	// Whether to wrap identifiers in double quotes (preserving case) or emit
	// them bare (folded to UPPERCASE by Oracle).  Set from
	// pParameters.quoteIdentifiers at the top of each public dialect method;
	// query building is synchronous so this closure value is safe to reuse.
	let _QuoteIdentifiers = false;

	/**
	* Generate a table name from the scope
	*
	* @method: generateTableName
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Returns the table name clause
	*/
	var generateTableName = function(pParameters)
	{
		// Every Foxhound query has a table name; this lazily creates the
		// parameterTypes map even for column-less queries (e.g. COUNT(*)).
		if (!pParameters.query.hasOwnProperty('parameterTypes'))
		{
			pParameters.query.parameterTypes = {};
		}

		if (_QuoteIdentifiers)
		{
			if (pParameters.scope && pParameters.scope.indexOf('"') >= 0)
			{
				return ' '+pParameters.scope;
			}
			return ' "'+pParameters.scope+'"';
		}

		return ' '+pParameters.scope;
	};

	/**
	* Record the oracledb bind type for a parameter, keyed by parameter name.
	*
	* These are driver-free strings ('NUMBER', 'STRING', 'CLOB', 'DATE') so the
	* dialect stays browser-safe; the Meadow Oracle provider translates them to
	* oracledb type descriptors at execution time (it is the only layer that may
	* require the driver).
	*
	* @method: generateOracleParameterTypeEntry
	* @param: {Object} pParameters SQL Query Parameters
	* @param: {String} pColumnParameterName The bind parameter name
	* @param: {Object|String} pColumn A schema column object, or a column name to look up
	* @return: {Boolean} True if a known type was mapped
	*/
	var generateOracleParameterTypeEntry = function(pParameters, pColumnParameterName, pColumn)
	{
		if (!pParameters.query.hasOwnProperty('parameterTypes'))
		{
			pParameters.query.parameterTypes = {};
		}

		let tmpColumnParameterTypeString = 'String';
		if (typeof(pColumn) == 'object')
		{
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
			_Fable.log.warn(`Meadow Oracle query attempted to add a parameter type but no valid column schema entry object or column name was passed; parameter name ${pColumnParameterName}.`);
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
			case 'ForeignKey':
			case 'Numeric':
			case 'Integer':
			case 'Deleted':
			case 'Boolean':
			case 'Decimal':
				pParameters.query.parameterTypes[pColumnParameterName] = 'NUMBER';
				break;

			case 'String':
			case 'AutoGUID':
				pParameters.query.parameterTypes[pColumnParameterName] = 'STRING';
				break;

			case 'Text':
			case 'JSON':
			case 'JSONProxy':
				pParameters.query.parameterTypes[pColumnParameterName] = 'CLOB';
				break;

			case 'CreateDate':
			case 'UpdateDate':
			case 'DeleteDate':
			case 'DateTime':
				pParameters.query.parameterTypes[pColumnParameterName] = 'DATE';
				break;

			default:
				pParameters.query.parameterTypes[pColumnParameterName] = 'STRING';
				return false;
		}

		return true;
	};

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
			return ` ${generateSafeFieldName(idColumn.Column)}`;
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
	* wrapper.  The outer FROM is a ROWNUM subquery, so the default
	* "Table.*" qualifier can't resolve there — we need either an explicit
	* column list from the schema or a bare "*".
	*
	* If the caller set explicit dataElements, reuse them (they reference bare
	* column names, which work fine against the subquery).  Otherwise emit an
	* explicit list from the schema to keep "_RowNum" from leaking.  As a last
	* resort, fall back to "*".
	*
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Field list (prefixed with a single leading space)
	*/
	var generateOuterFieldListForLegacyPagination = function(pParameters)
	{
		var tmpDataElements = pParameters.dataElements;
		if (Array.isArray(tmpDataElements) && tmpDataElements.length > 0)
		{
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
		// "_RowNum" will surface on marshalled records; downstream code can
		// ignore it.  Schemas are the norm via Meadow so this is rare.
		return ' *';
	};

	const SURROUNDING_QUOTES_AND_WHITESPACE_REGEX = /^[" ]+|[" ]+$/g;

	const cleanseQuoting = (str) =>
	{
		return str.replace(SURROUNDING_QUOTES_AND_WHITESPACE_REGEX, '');
	};

	/**
	* Ensure a field name is emitted correctly for the current quoting mode.
	*
	* Unquoted (default): bare identifiers (Oracle folds to UPPERCASE).
	* Quoted: wrapped in double quotes, preserving case.
	*/
	var generateSafeFieldName = function(pFieldName)
	{
		let pFieldNames = pFieldName.split('.');
		if (pFieldNames.length > 1)
		{
			const cleansedTable = cleanseQuoting(pFieldNames[0]);
			const cleansedFieldName = cleanseQuoting(pFieldNames[1]);
			if (cleansedFieldName === '*')
			{
				return _QuoteIdentifiers ? '"'+cleansedTable+'".*' : cleansedTable+'.*';
			}
			return _QuoteIdentifiers
				? '"'+cleansedTable+'"."'+cleansedFieldName+'"'
				: cleansedTable+'.'+cleansedFieldName;
		}
		const cleansedFieldName = cleanseQuoting(pFieldNames[0]);
		if (cleansedFieldName === '*')
		{
			return '*';
		}
		return _QuoteIdentifiers ? '"'+cleansedFieldName+'"' : cleansedFieldName;
	};

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

		if (!pParameters.query.disableDeleteTracking)
		{
			// Check if there is a Deleted column on the Schema. If so, we add this to the filters automatically (if not already present)
			var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
			for (var i = 0; i < tmpSchema.length; i++)
			{
				var tmpSchemaEntry = tmpSchema[i];

				if (tmpSchemaEntry.Type === 'Deleted')
				{
					var tmpHasDeletedParameter = false;

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
				tmpWhere += ' (';
				tmpLastOperatorNoConnector = true;
			}
			else if (tmpFilter[i].Operator === ')')
			{
				tmpWhere += ' )';
			}
			else if (tmpFilter[i].Operator === 'IN' || tmpFilter[i].Operator === "NOT IN")
			{
				// oracledb will not expand a single bound array into an IN list,
				// so expand the value list into discrete :name binds here.
				var tmpInValues = Array.isArray(tmpFilter[i].Value)
					? tmpFilter[i].Value
					: String(tmpFilter[i].Value).split(',');
				var tmpInPlaceholders = [];
				for (var v = 0; v < tmpInValues.length; v++)
				{
					var tmpInParameter = tmpFilter[i].Parameter+'_w'+i+'_'+v;
					tmpInPlaceholders.push(':'+tmpInParameter);
					pParameters.query.parameters[tmpInParameter] = tmpInValues[v];
					generateOracleParameterTypeEntry(pParameters, tmpInParameter, tmpFilter[i].Parameter);
				}
				tmpWhere += ' '+generateSafeFieldName(tmpFilter[i].Column)+' '+tmpFilter[i].Operator+' ('+tmpInPlaceholders.join(', ')+')';
			}
			else if (tmpFilter[i].Operator === 'IS NULL')
			{
				tmpWhere += ' '+generateSafeFieldName(tmpFilter[i].Column)+' '+tmpFilter[i].Operator;
			}
			else if (tmpFilter[i].Operator === 'IS NOT NULL')
			{
				tmpWhere += ' '+generateSafeFieldName(tmpFilter[i].Column)+' '+tmpFilter[i].Operator;
			}
			else
			{
				tmpColumnParameter = tmpFilter[i].Parameter+'_w'+i;
				var tmpSchemaForJson = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
				var tmpJsonRef = resolveJsonColumnPath(tmpFilter[i].Column, tmpSchemaForJson);
				if (tmpJsonRef)
				{
					tmpWhere += ' JSON_VALUE('+generateSafeFieldName(tmpJsonRef.column)+", '"+tmpJsonRef.path+"') "+tmpFilter[i].Operator+' :'+tmpColumnParameter;
				}
				else
				{
					tmpWhere += ' '+generateSafeFieldName(tmpFilter[i].Column)+' '+tmpFilter[i].Operator+' :'+tmpColumnParameter;
				}
				pParameters.query.parameters[tmpColumnParameter] = tmpFilter[i].Value;
				generateOracleParameterTypeEntry(pParameters, tmpColumnParameter, tmpFilter[i].Parameter);
			}
		}

		return tmpWhere;
	};

	/**
	* Find the column whose value the database generates on INSERT.
	*
	* This is the RETURNING target, so it must stay strictly AutoIdentity — a
	* primary key the caller supplies has nothing to return.  Ordering asks a
	* different question; see findIdentityColumn.
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

		// A join can bring in a same-named identity column from another table,
		// which would make an unqualified ORDER BY ambiguous.
		var tmpColumn = tmpIdentityColumn;
		if (Array.isArray(pParameters.join) && pParameters.join.length > 0 &&
			typeof(pParameters.scope) === 'string' && pParameters.scope.indexOf('.') < 0 && pParameters.scope.indexOf('"') < 0)
		{
			tmpColumn = pParameters.scope + '.' + tmpIdentityColumn;
		}

		tmpSort.push({ Column: tmpColumn, Direction: 'Ascending' });
		return tmpSort;
	};

	/**
	* Generate an ORDER BY clause from the sort array
	*
	* A capped read has the identity column appended as a final tiebreaker so
	* paging is deterministic.  Unlike MSSQL, Oracle permits OFFSET/FETCH and
	* ROWNUM paging without an ORDER BY, so when no identity can be resolved we
	* simply omit the clause rather than emitting an invalid "ORDER BY (SELECT 1)".
	*
	* @method: generateOrderBy
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Returns the order by clause
	*/
	var generateOrderBy = function(pParameters)
	{
		var tmpOrderBy = resolveStableSort(pParameters);
		if (!Array.isArray(tmpOrderBy) || tmpOrderBy.length < 1)
		{
			return '';
		}

		var tmpOrderClause = ' ORDER BY';
		for (var i = 0; i < tmpOrderBy.length; i++)
		{
			if (i > 0)
			{
				tmpOrderClause += ',';
			}
			tmpOrderClause += ' '+generateSafeFieldName(tmpOrderBy[i].Column);

			if (tmpOrderBy[i].Direction == 'Descending')
			{
				tmpOrderClause += ' DESC';
			}
		}
		return tmpOrderClause;
	};

	/**
	* Generate the limit clause using the 12c+ OFFSET/FETCH syntax.
	*
	* When pParameters.legacyPagination is set the Read function wraps the
	* query in a ROWNUM subquery instead (11g and earlier have no OFFSET/FETCH),
	* so this returns an empty string in that case.
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
			return '';
		}

		var tmpLimit = ' OFFSET ';
		if (pParameters.begin !== false)
		{
			tmpLimit += pParameters.begin;
		}
		else
		{
			tmpLimit += '0';
		}
		tmpLimit += ` ROWS FETCH NEXT ${pParameters.cap} ROWS ONLY`;

		return tmpLimit;
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

		var tmpJoinClause = '';
		for (var i = 0; i < tmpJoins.length; i++)
		{
			var join = tmpJoins[i];
			if (join.Type && join.Table && join.From && join.To)
			{
				var tmpJoinTable = _QuoteIdentifiers ? '"'+join.Table+'"' : join.Table;
				tmpJoinClause += ` ${join.Type} ${tmpJoinTable} ON ${join.From} = ${join.To}`;
			}
		}

		return tmpJoinClause;
	};

	/**
	* Generate the update SET clause
	*
	* @method: generateUpdateSetters
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Returns the update set clause
	*/
	var generateUpdateSetters = function(pParameters)
	{
		var tmpRecords = pParameters.query.records;
		if (!Array.isArray(tmpRecords) || tmpRecords.length < 1)
		{
			return false;
		}

		var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];

		var tmpUpdate = '';
		var tmpCurrentColumn = 0;
		for(var tmpColumn in tmpRecords[0])
		{
			var tmpSchemaEntry = {Column:tmpColumn, Type:'Default'};
			for (var i = 0; i < tmpSchema.length; i++)
			{
				if (tmpColumn == tmpSchema[i].Column)
				{
					tmpSchemaEntry = tmpSchema[i];
					break;
				}
			}

			if (pParameters.query.disableAutoUserStamp &&
				tmpSchemaEntry.Type === 'UpdateIDUser')
			{
				continue;
			}

			switch (tmpSchemaEntry.Type)
			{
				case 'AutoIdentity':
				case 'CreateDate':
				case 'CreateIDUser':
				case 'DeleteDate':
				case 'DeleteIDUser':
					continue;
			}
			if (tmpCurrentColumn > 0)
			{
				tmpUpdate += ',';
			}
			switch (tmpSchemaEntry.Type)
			{
				case 'UpdateDate':
					if (pParameters.query.disableAutoDateStamp)
					{
						var tmpColumnParameter = 'MANUAL_UpdateDate';
						tmpUpdate += ' '+generateSafeFieldName(tmpColumn)+' = :MANUAL_UpdateDate';
						pParameters.query.parameters[tmpColumnParameter] = tmpRecords[0][tmpColumn];
						generateOracleParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
					}
					else
					{
						tmpUpdate += ' '+generateSafeFieldName(tmpColumn)+' = ' + SQL_NOW;
					}
					break;
				case 'UpdateIDUser':
					var tmpColumnParameter = tmpColumn+'_'+tmpCurrentColumn;
					tmpUpdate += ' '+generateSafeFieldName(tmpColumn)+' = :'+tmpColumnParameter;
					pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
					generateOracleParameterTypeEntry(pParameters, tmpColumnParameter, tmpColumn);
					break;
				case 'JSON':
					var tmpJSONUpdateParam = tmpColumn+'_'+tmpCurrentColumn;
					tmpUpdate += ' '+generateSafeFieldName(tmpColumn)+' = :'+tmpJSONUpdateParam;
					pParameters.query.parameters[tmpJSONUpdateParam] = (typeof tmpRecords[0][tmpColumn] === 'string')
						? tmpRecords[0][tmpColumn]
						: JSON.stringify(tmpRecords[0][tmpColumn] || {});
					generateOracleParameterTypeEntry(pParameters, tmpJSONUpdateParam, {Type:'Text'});
					break;
				case 'JSONProxy':
					var tmpProxyUpdateParam = tmpSchemaEntry.StorageColumn+'_'+tmpCurrentColumn;
					tmpUpdate += ' '+generateSafeFieldName(tmpSchemaEntry.StorageColumn)+' = :'+tmpProxyUpdateParam;
					pParameters.query.parameters[tmpProxyUpdateParam] = (typeof tmpRecords[0][tmpColumn] === 'string')
						? tmpRecords[0][tmpColumn]
						: JSON.stringify(tmpRecords[0][tmpColumn] || {});
					generateOracleParameterTypeEntry(pParameters, tmpProxyUpdateParam, {Type:'Text'});
					break;
				default:
					var tmpColumnDefaultParameter = tmpColumn+'_'+tmpCurrentColumn;
					tmpUpdate += ' '+generateSafeFieldName(tmpColumn)+' = :'+tmpColumnDefaultParameter;
					pParameters.query.parameters[tmpColumnDefaultParameter] = tmpRecords[0][tmpColumn];
					generateOracleParameterTypeEntry(pParameters, tmpColumnDefaultParameter, tmpSchemaEntry);
					break;
			}

			tmpCurrentColumn++;
		}

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
	* @return: {String} Returns the soft-delete set clause
	*/
	var generateUpdateDeleteSetters = function(pParameters)
	{
		if (pParameters.query.disableDeleteTracking)
		{
			return false;
		}
		var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];

		var tmpCurrentColumn = 0;
		var tmpHasDeletedField = false;
		var tmpUpdate = '';
		var tmpSchemaEntry = {Type:'Default'};
		for (var i = 0; i < tmpSchema.length; i++)
		{
			tmpSchemaEntry = tmpSchema[i];

			var tmpUpdateSql = null;

			switch (tmpSchemaEntry.Type)
			{
				case 'Deleted':
					tmpUpdateSql = ' '+generateSafeFieldName(tmpSchemaEntry.Column)+' = 1';
					tmpHasDeletedField = true;
					break;
				case 'DeleteDate':
					tmpUpdateSql = ' '+generateSafeFieldName(tmpSchemaEntry.Column)+' = ' + SQL_NOW;
					break;
				case 'UpdateDate':
					tmpUpdateSql = ' '+generateSafeFieldName(tmpSchemaEntry.Column)+' = ' + SQL_NOW;
					break;
				case 'DeleteIDUser':
					var tmpColumnParameter = tmpSchemaEntry.Column+'_'+tmpCurrentColumn;
					tmpUpdateSql = ' '+generateSafeFieldName(tmpSchemaEntry.Column)+' = :'+tmpColumnParameter;
					pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
					generateOracleParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
					break;
				default:
					continue;
			}

			if (tmpCurrentColumn > 0)
			{
				tmpUpdate += ',';
			}

			tmpUpdate += tmpUpdateSql;

			tmpCurrentColumn++;
		}

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
	* @return: {String} Returns the soft-undelete set clause
	*/
	var generateUpdateUndeleteSetters = function(pParameters)
	{
		var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];

		var tmpCurrentColumn = 0;
		var tmpHasDeletedField = false;
		var tmpUpdate = '';
		var tmpSchemaEntry = {Type:'Default'};
		for (var i = 0; i < tmpSchema.length; i++)
		{
			tmpSchemaEntry = tmpSchema[i];

			var tmpUpdateSql = null;

			switch (tmpSchemaEntry.Type)
			{
				case 'Deleted':
					tmpUpdateSql = ' '+generateSafeFieldName(tmpSchemaEntry.Column)+' = 0';
					tmpHasDeletedField = true;
					break;
				case 'UpdateDate':
					tmpUpdateSql = ' '+generateSafeFieldName(tmpSchemaEntry.Column)+' = ' + SQL_NOW;
					break;
				case 'UpdateIDUser':
					var tmpColumnParameter = tmpSchemaEntry.Column+'_'+tmpCurrentColumn;
					tmpUpdateSql = ' '+generateSafeFieldName(tmpSchemaEntry.Column)+' = :'+tmpColumnParameter;
					pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
					generateOracleParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
					break;
				default:
					continue;
			}

			if (tmpCurrentColumn > 0)
			{
				tmpUpdate += ',';
			}

			tmpUpdate += tmpUpdateSql;

			tmpCurrentColumn++;
		}

		if (!tmpHasDeletedField ||
			tmpUpdate === '')
		{
			return false;
		}

		return tmpUpdate;
	};

	/**
	* Generate the create SET clause values
	*
	* @method: generateCreateSetValues
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Returns the insert values clause
	*/
	var generateCreateSetValues = function(pParameters)
	{
		var tmpRecords = pParameters.query.records;
		if (!Array.isArray(tmpRecords) || tmpRecords.length < 1)
		{
			return false;
		}

		var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];

		var tmpCreateSet = '';
		var tmpCurrentColumn = 0;
		for(var tmpColumn in tmpRecords[0])
		{
			var tmpSchemaEntry = {Column:tmpColumn, Type:'Default'};
			for (var i = 0; i < tmpSchema.length; i++)
			{
				if (tmpColumn == tmpSchema[i].Column)
				{
					tmpSchemaEntry = tmpSchema[i];
					break;
				}
			}

			if (!pParameters.query.disableDeleteTracking)
			{
				if (tmpSchemaEntry.Type === 'DeleteDate' ||
					tmpSchemaEntry.Type === 'DeleteIDUser')
				{
					continue;
				}
			}

			// AutoIdentity is omitted entirely from the INSERT (the IDENTITY
			// column or the BEFORE-INSERT sequence trigger supplies it); skip
			// adding a separator for it unless the consumer is overriding it.
			if (tmpSchemaEntry.Type === 'AutoIdentity' && !pParameters.query.disableAutoIdentity)
			{
				continue;
			}

			if ((tmpCurrentColumn > 0) && (tmpCreateSet != ''))
			{
				tmpCreateSet += ',';
			}

			var buildDefaultDefinition = function()
			{
				var tmpColumnParameter = tmpColumn+'_'+tmpCurrentColumn;
				tmpCreateSet += ' :'+tmpColumnParameter;
				pParameters.query.parameters[tmpColumnParameter] = tmpRecords[0][tmpColumn];
				generateOracleParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
			};

			var tmpColumnParameter;
			switch (tmpSchemaEntry.Type)
			{
				case 'AutoIdentity':
					// Only reached when disableAutoIdentity is set (overriding
					// the generated key with an explicit value).
					buildDefaultDefinition();
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
						buildDefaultDefinition();
					}
					else
					{
						tmpColumnParameter = tmpColumn+'_'+tmpCurrentColumn;
						tmpCreateSet += ' :'+tmpColumnParameter;
						pParameters.query.parameters[tmpColumnParameter] = pParameters.query.UUID;
						generateOracleParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
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
						tmpColumnParameter = tmpColumn+'_'+tmpCurrentColumn;
						tmpCreateSet += ' :'+tmpColumnParameter;
						pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
						generateOracleParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
					}
					break;
				case 'JSON':
					var tmpJSONCreateParam = tmpColumn+'_'+tmpCurrentColumn;
					tmpCreateSet += ' :'+tmpJSONCreateParam;
					pParameters.query.parameters[tmpJSONCreateParam] = (typeof tmpRecords[0][tmpColumn] === 'string')
						? tmpRecords[0][tmpColumn]
						: JSON.stringify(tmpRecords[0][tmpColumn] || {});
					generateOracleParameterTypeEntry(pParameters, tmpJSONCreateParam, {Type:'Text'});
					break;
				case 'JSONProxy':
					var tmpProxyCreateParam = tmpColumn+'_'+tmpCurrentColumn;
					tmpCreateSet += ' :'+tmpProxyCreateParam;
					pParameters.query.parameters[tmpProxyCreateParam] = (typeof tmpRecords[0][tmpColumn] === 'string')
						? tmpRecords[0][tmpColumn]
						: JSON.stringify(tmpRecords[0][tmpColumn] || {});
					generateOracleParameterTypeEntry(pParameters, tmpProxyCreateParam, {Type:'Text'});
					break;
				default:
					buildDefaultDefinition();
					break;
			}

			tmpCurrentColumn++;
		}

		if (tmpCreateSet === '')
		{
			return false;
		}

		return tmpCreateSet;
	};

	/**
	* Generate the create SET clause column list
	*
	* @method: generateCreateSetList
	* @param: {Object} pParameters SQL Query Parameters
	* @return: {String} Returns the insert column list
	*/
	var generateCreateSetList = function(pParameters)
	{
		var tmpRecords = pParameters.query.records;

		var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];

		var tmpCreateSet = '';
		for(var tmpColumn in tmpRecords[0])
		{
			var tmpSchemaEntry = {Column:tmpColumn, Type:'Default'};
			for (var i = 0; i < tmpSchema.length; i++)
			{
				if (tmpColumn == tmpSchema[i].Column)
				{
					tmpSchemaEntry = tmpSchema[i];
					break;
				}
			}
			if (!pParameters.query.disableDeleteTracking)
			{
				if (tmpSchemaEntry.Type === 'DeleteDate' ||
					tmpSchemaEntry.Type === 'DeleteIDUser')
				{
					continue;
				}
			}
			switch (tmpSchemaEntry.Type)
			{
				case 'AutoIdentity':
					// Skipped on INSERT (IDENTITY/sequence trigger supplies it)
					// unless the consumer is overriding the value.
					if (pParameters.query.disableAutoIdentity)
					{
						if (tmpCreateSet != '')
						{
							tmpCreateSet += ',';
						}
						tmpCreateSet += ' '+generateSafeFieldName(tmpColumn);
					}
					continue;
				case 'JSONProxy':
					if (tmpCreateSet != '')
					{
						tmpCreateSet += ',';
					}
					tmpCreateSet += ' '+generateSafeFieldName(tmpSchemaEntry.StorageColumn);
					break;
				default:
					if (tmpCreateSet != '')
					{
						tmpCreateSet += ',';
					}
					tmpCreateSet += ' '+generateSafeFieldName(tmpColumn);
					break;
			}
		}

		return tmpCreateSet;
	};


	var Create = function(pParameters)
	{
		_QuoteIdentifiers = !!pParameters.quoteIdentifiers;
		var tmpTableName = generateTableName(pParameters);
		var tmpCreateSetList = generateCreateSetList(pParameters);
		var tmpCreateSetValues = generateCreateSetValues(pParameters);

		if (!tmpCreateSetValues)
		{
			return false;
		}

		// Oracle has no SCOPE_IDENTITY(); return the generated key via a
		// RETURNING ... INTO out-bind that the Meadow Oracle provider reads.
		var tmpReturning = '';
		if (!pParameters.query.disableAutoIdentity)
		{
			var tmpIDColumn = findPrimaryKeyColumn(pParameters);
			if (tmpIDColumn)
			{
				tmpReturning = ' RETURNING '+generateSafeFieldName(tmpIDColumn)+' INTO :RETURNING_ID';
			}
		}

		return 'INSERT INTO'+tmpTableName+' ('+tmpCreateSetList+') VALUES ('+tmpCreateSetValues+')'+tmpReturning;
	};


	/**
	* Read one or many records
	*
	* @method Read
	* @param {Object} pParameters SQL Query parameters
	* @return {String} Returns the generated query.
	*/
	var Read = function(pParameters)
	{
		_QuoteIdentifiers = !!pParameters.quoteIdentifiers;
		var tmpFieldList = generateFieldList(pParameters);
		var tmpTableName = generateTableName(pParameters);
		var tmpWhere = generateWhere(pParameters);
		var tmpJoin = generateJoins(pParameters);
		var tmpOrderBy = generateOrderBy(pParameters);
		var tmpLimit = generateLimit(pParameters);
		const tmpOptDistinct = pParameters.distinct ? ' DISTINCT' : '';

		if (pParameters.queryOverride)
		{
			try
			{
				var tmpQueryTemplate = _Fable.Utility.template(pParameters.queryOverride);
				return tmpQueryTemplate({FieldList:tmpFieldList, TableName:tmpTableName, Where:tmpWhere, Join:tmpJoin, OrderBy:tmpOrderBy, Limit:tmpLimit, Distinct: tmpOptDistinct, _Params: pParameters});
			}
			catch (pError)
			{
				console.log('Error with custom Read Query ['+pParameters.queryOverride+']: '+pError);
				return false;
			}
		}

		// Legacy pagination path — wrap in a ROWNUM double-subquery for 11g
		// and earlier, which have no OFFSET/FETCH.  The innermost query keeps
		// the ORDER BY; the middle query captures ROWNUM with an upper-bound
		// predicate (enabling a COUNT STOPKEY short-circuit); the outer query
		// applies the lower bound.  Enabled via pParameters.legacyPagination
		// (forwarded from the meadow-connection-oracle LegacyPagination config).
		if (pParameters.legacyPagination && pParameters.cap)
		{
			var tmpBegin = (pParameters.begin !== false) ? pParameters.begin : 0;
			var tmpEnd = tmpBegin + pParameters.cap;
			var tmpOuterFieldList = generateOuterFieldListForLegacyPagination(pParameters);
			return `SELECT${tmpOptDistinct}${tmpOuterFieldList} FROM (SELECT meadow_inner.*, ROWNUM AS "_RowNum" FROM (SELECT${tmpFieldList} FROM${tmpTableName}${tmpJoin}${tmpWhere}${tmpOrderBy}) meadow_inner WHERE ROWNUM <= ${tmpEnd}) WHERE "_RowNum" > ${tmpBegin}`;
		}

		return `SELECT${tmpOptDistinct}${tmpFieldList} FROM${tmpTableName}${tmpJoin}${tmpWhere}${tmpOrderBy}${tmpLimit}`;
	};

	var Update = function(pParameters)
	{
		_QuoteIdentifiers = !!pParameters.quoteIdentifiers;
		var tmpTableName = generateTableName(pParameters);
		var tmpUpdateSetters = generateUpdateSetters(pParameters);
		var tmpWhere = generateWhere(pParameters);

		if (!tmpUpdateSetters)
		{
			return false;
		}

		return 'UPDATE'+tmpTableName+' SET'+tmpUpdateSetters+tmpWhere;
	};

	var Delete = function(pParameters)
	{
		_QuoteIdentifiers = !!pParameters.quoteIdentifiers;
		var tmpTableName = generateTableName(pParameters);
		var tmpUpdateDeleteSetters = generateUpdateDeleteSetters(pParameters);
		var tmpWhere = generateWhere(pParameters);

		if (tmpUpdateDeleteSetters)
		{
			return 'UPDATE'+tmpTableName+' SET'+tmpUpdateDeleteSetters+tmpWhere;
		}
		else
		{
			return 'DELETE FROM'+tmpTableName+tmpWhere;
		}
	};

	var Undelete = function(pParameters)
	{
		_QuoteIdentifiers = !!pParameters.quoteIdentifiers;
		var tmpTableName = generateTableName(pParameters);
		let tmpDeleteTrackingState = pParameters.query.disableDeleteTracking;
		pParameters.query.disableDeleteTracking = true;
		var tmpUpdateUndeleteSetters = generateUpdateUndeleteSetters(pParameters);
		var tmpWhere = generateWhere(pParameters);
		pParameters.query.disableDeleteTracking = tmpDeleteTrackingState;

		if (tmpUpdateUndeleteSetters)
		{
			return 'UPDATE'+tmpTableName+' SET'+tmpUpdateUndeleteSetters+tmpWhere;
		}
		else
		{
			// No-op — the record can't be undeleted.  Oracle requires a FROM.
			return 'SELECT NULL FROM DUAL';
		}
	};

	var Count = function(pParameters)
	{
		_QuoteIdentifiers = !!pParameters.quoteIdentifiers;
		var tmpFieldList = pParameters.distinct ? generateFieldList(pParameters, true) : '*';
		var tmpTableName = generateTableName(pParameters);
		var tmpJoin = generateJoins(pParameters);
		var tmpWhere = generateWhere(pParameters);
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
				return tmpQueryTemplate({FieldList:[], TableName:tmpTableName, Where:tmpWhere, OrderBy:'', Limit:'', Distinct: tmpOptDistinct, _Params: pParameters});
			}
			catch (pError)
			{
				console.log('Error with custom Count Query ['+pParameters.queryOverride+']: '+pError);
				return false;
			}
		}

		return `SELECT COUNT(${tmpOptDistinct}${tmpFieldList || '*'}) AS RowCount FROM${tmpTableName}${tmpJoin}${tmpWhere}`;
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
			get: function() { return 'Oracle'; },
			enumerable: true
		});

	return tmpDialect;
};

module.exports = FoxHoundDialectOracle;
