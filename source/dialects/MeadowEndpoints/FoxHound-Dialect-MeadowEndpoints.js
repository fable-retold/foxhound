/**
* FoxHound Meadow Endpoints Dialect
*
* @license MIT
*
* @author Steven Velozo <steven@velozo.com>
* @class FoxHoundDialectMeadowEndpoints
*/

var FoxHoundDialectMeadowEndpoints = function()
{
	/**
	 * Generate a table name from the scope
	 *
	 * @method: generateTableName
	 * @param {Object} pParameters SQL Query Parameters
	 * @return {String} Returns the table name clause
	 */
	var generateTableName = function(pParameters)
	{
		return pParameters.scope;
	};

	/**
	 * Generate the Identity column from the schema or scope
	 * 
	 * @method: generateIdentityColumnName
	 * @param {Object} pParameters SQL Query Parameters
	 * @return {String} Returns the table name clause
	 */
	var generateIdentityColumnName = function(pParameters)
	{
		// TODO: See about using the Schema or the Schemata for this
		return `ID${pParameters.scope}`;
	};

	/**
	 * Generate a field list from the array of dataElements
	 *
	 * Each entry in the dataElements is a simple string
	 *
	 * @method: generateFieldList
	 * @param {Object} pParameters SQL Query Parameters
	 * @return {String} Returns the field list clause
	 */
	var generateFieldList = function(pParameters)
	{
		var tmpDataElements = pParameters.dataElements;
		if (!Array.isArray(tmpDataElements) || tmpDataElements.length < 1)
		{
			return '';
		}

		var tmpFieldList = '';
		for (var i = 0; i < tmpDataElements.length; i++)
		{
			if (i > 0)
			{
				tmpFieldList += ',';
			}

            tmpFieldList += tmpDataElements[i];
		}
		return tmpFieldList;
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
	 * @param {Object} pParameters SQL Query Parameters
	 * @return {String} Returns the WHERE clause prefixed with WHERE, or an empty string if unnecessary
	 */
	var generateWhere = function(pParameters)
	{
		var tmpFilter = Array.isArray(pParameters.filter) ? pParameters.filter : [];
		var tmpTableName = generateTableName(pParameters);
        
        var tmpURL = '';

        let tmpfAddFilter = (pFilterCommand, pFilterParameters) =>
        {
            if (tmpURL.length > 0)
            {
                tmpURL += '~';
            }
            
            tmpURL += `${pFilterCommand}~${pFilterParameters[0]}~${pFilterParameters[1]}~${pFilterParameters[2]}`;
        };

        let tmpfTranslateOperator = (pOperator) =>
        {
            let tmpNewOperator = 'EQ';
            switch(pOperator.toUpperCase())
            {
                case '!=':
                    tmpNewOperator = 'NE';
                    break;
                case '>':
                    tmpNewOperator = 'GT';
                    break;
                case '>=':
                    tmpNewOperator = 'GE';
                    break;
                case '<=':
                    tmpNewOperator = 'LE';
                    break;
                case '<':
                    tmpNewOperator = 'LT';
                    break;
                case 'LIKE':
                    tmpNewOperator = 'LK';
                    break;
                case 'IN':
                    tmpNewOperator = 'INN';
                    break;
                case 'NOT IN':
                    tmpNewOperator = 'NIN';
                    break;
            }
            return tmpNewOperator;
        }

        // Translating Delete Tracking bit on query to a query with automagic
        // This will eventually deprecate this as part of the necessary query
        if (pParameters.query.disableDeleteTracking)
        {
            tmpfAddFilter('FBV',['Deleted','GE','0'])
        }

		for (var i = 0; i < tmpFilter.length; i++)
		{
			if (tmpFilter[i].Operator === '(')
			{
                tmpfAddFilter('FOP',['0','(','0']);
			}
			else if (tmpFilter[i].Operator === ')')
			{
				// Close a logical grouping
                tmpfAddFilter('FCP',['0',')','0']);
			}
			else if (tmpFilter[i].Operator === 'IN' || tmpFilter[i].Operator === "NOT IN")
			{
                // FBL, not FBV: only the list stanzas split their value on
                // commas at the far end. An FBV carrying "a,b,c" arrives
                // upstream as the single scalar string "a,b,c", and a numeric
                // column then coerces it to its leading integer — the whole
                // list silently collapses to its first element.
                let tmpFilterCommand = 'FBL';
                if (tmpFilter[i].Connector == 'OR')
                {
                    tmpFilterCommand = 'FBLOR';
                }
                let tmpValues = Array.isArray(tmpFilter[i].Value) ? tmpFilter[i].Value : [tmpFilter[i].Value];
				// Add the column name, operator and parameter name to the list of where value parenthetical
                tmpfAddFilter(tmpFilterCommand, [tmpFilter[i].Column, tmpfTranslateOperator(tmpFilter[i].Operator), tmpValues.map(encodeURIComponent).join(',')])
			}
			else if (tmpFilter[i].Operator === 'IS NULL')
			{
				// IS NULL is a special operator which doesn't require a value, or parameter
                tmpfAddFilter('FBV', [tmpFilter[i].Column, 'IN', '0']);
			}
			else if (tmpFilter[i].Operator === 'IS NOT NULL')
			{
				// IS NOT NULL is a special operator which doesn't require a value, or parameter
                tmpfAddFilter('FBV', [tmpFilter[i].Column, 'NN', '0']);
			}
			else
			{
                let tmpFilterCommand = 'FBV';
                if (tmpFilter[i].Connector == 'OR')
                {
                    tmpFilterCommand = 'FBVOR';
                }
				// Add the column name, operator and parameter name to the list of where value parenthetical
                tmpfAddFilter(tmpFilterCommand, [tmpFilter[i].Column, tmpfTranslateOperator(tmpFilter[i].Operator), encodeURIComponent(tmpFilter[i].Value)]);
			}
		}

        let tmpOrderBy = generateOrderBy(pParameters);
        if (tmpOrderBy)
        {
            if (tmpURL)
            {
                tmpURL += '~';
            }
            tmpURL += tmpOrderBy;
        }

		return tmpURL;
	};

    /**
	 * Get the flags for the request
     * 
     * These are usually passed in for Update and Create when extra tracking is disabled.
	 *
	 * @method: generateFlags
	 * @param {Object} pParameters SQL Query Parameters
	 * @return {String} Flags to be sent, if any.
	 */
    function generateFlags(pParameters)
    {
        let tmpDisableAutoDateStamp = pParameters.query.disableAutoDateStamp;
        let tmpDisableDeleteTracking = pParameters.query.disableDeleteTracking;
        let tmpDisableAutoIdentity = pParameters.query.disableAutoIdentity;
        let tmpDisableAutoUserStamp = pParameters.query.disableAutoUserStamp;

        let tmpFlags = '';

        let fAddFlag = (pFlagSet, pFlag) =>
            {
                if (pFlagSet)
                {
                    if (tmpFlags.length > 0)
                    {
                        tmpFlags += ',';
                    }
                    tmpFlags += pFlag;
                }
            };

        fAddFlag(tmpDisableAutoDateStamp, 'DisableAutoDateStamp');
        fAddFlag(tmpDisableDeleteTracking, 'DisableDeleteTracking');
        fAddFlag(tmpDisableAutoIdentity, 'DisableAutoIdentity');
        fAddFlag(tmpDisableAutoUserStamp, 'DisableAutoUserStamp');

        return tmpFlags;
    };

    /**
	 * Get the ID for the record, to be used in URIs
	 *
	 * @method: getIDRecord
	 * @param {Object} pParameters SQL Query Parameters
	 * @return {String} ID of the record in string form for the URI
	 */
	var getIDRecord = function(pParameters)
	{
        var tmpFilter = Array.isArray(pParameters.filter) ? pParameters.filter : [];

		var tmpIDRecord = false;

        if (tmpFilter.length < 1)
		{
			return tmpIDRecord;
		}

		for (var i = 0; i < tmpFilter.length; i++)
		{
            // Check Schema Entry Type
            var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
			var tmpSchemaEntry = {Column:tmpFilter[i].Column, Type:'Default'};
			for (var j = 0; j < tmpSchema.length; j++)
			{
                // If this column is the AutoIdentity, set it.
				if ((tmpFilter[i].Column == tmpSchema[j].Column) &&
                    (tmpSchema[j].Type == 'AutoIdentity'))
				{
                    tmpIDRecord = tmpFilter[i].Value;
					break;
				}
			}
		}

		return tmpIDRecord;
    }
	
    /**
	 * Generate an ORDER BY clause from the sort array
	 *
	 * Each entry in the sort is an object like:
	 * {Column:'Color',Direction:'Descending'}
	 *
	 * @method: generateOrderBy
	 * @param {Object} pParameters SQL Query Parameters
	 * @return {String} Returns the field list clause
	 */
	var generateOrderBy = function(pParameters)
	{
		var tmpOrderBy = pParameters.sort;
		/** @type {string} */
		var tmpOrderClause = null;

        if (!Array.isArray(tmpOrderBy) || tmpOrderBy.length < 1)
		{
			return tmpOrderClause;
		}

        tmpOrderClause = '';

        for (var i = 0; i < tmpOrderBy.length; i++)
		{
			if (i > 0)
			{
				tmpOrderClause += '~';
			}
			tmpOrderClause += `FSF~${tmpOrderBy[i].Column}~`;

			if (tmpOrderBy[i].Direction == 'Descending')
			{
				tmpOrderClause += 'DESC~0';
			}
            else
            {
                tmpOrderClause += 'ASC~0'
            }
		}
		return tmpOrderClause;
	};

	/**
	 * Generate the limit clause
	 *
	 * @method: generateLimit
	 * @param {Object} pParameters SQL Query Parameters
	 * @return {String} Returns the table name clause
	 */
	var generateLimit = function(pParameters)
	{
		if (!pParameters.cap)
		{
			return '';
		}

        let tmpBegin = (pParameters.begin !== false) ? pParameters.begin : 0;

        return `${tmpBegin}/${pParameters.cap}`;
	};

	var Create = function(pParameters)
	{
		var tmpTableName = generateTableName(pParameters);
        var tmpFlags = generateFlags(pParameters);

        if (tmpTableName)
        {
            let tmpURL = tmpTableName;
            if (tmpFlags)
            {
                tmpURL = `${tmpURL}/WithFlags/${tmpFlags}`
            }
            return tmpURL;
        }
        else
        {
            return false;
        }
	};


	/**
	* Read one or many records
	*
	* @method Read
	* @param {Object} pParameters SQL Query parameters
	* @return {String} Returns the current Query for chaining.
	*/
	var Read = function(pParameters)
	{
		var tmpTableName = generateTableName(pParameters);
		var tmpFieldList = generateFieldList(pParameters);
		var tmpWhere = generateWhere(pParameters);
		var tmpLimit = generateLimit(pParameters);

		var tmpURL = `${tmpTableName}`;
		// In the case that there is only a single query parameter, and the parameter is a single identity, 
		// we will cast it to the READ endpoint rather than READS.
		if ((pParameters.filter)
			 && (pParameters.filter.length == 1)
             // If there is exactly one query filter parameter
			 && (pParameters.filter[0].Column === generateIdentityColumnName(pParameters))
			 // AND It is the Identity column
			 && (pParameters.filter[0].Operator === '=')
			 // AND The comparators is a simple equals 
			 && (tmpLimit == '') && (tmpFieldList == '')
			 // AND There is no limit or field list set
			 && (!pParameters.sort))
			 // AND There is no sort clause
		{
			// THEN This is a SINGLE READ by presumption.
			// There are some bad side affects this could cause with chaining and overridden behaviors, if 
			// we are requesting a filtered list of 1 record.
			tmpURL = `${tmpURL}/${pParameters.filter[0].Value}`;
		}
		else
		{
			tmpURL = `${tmpURL}s`;
			if (tmpFieldList)
			{
				tmpURL = `${tmpURL}/LiteExtended/${tmpFieldList}`
			}
			if (tmpWhere)
			{
				tmpURL = `${tmpURL}/FilteredTo/${tmpWhere}`;
			}
			if (tmpLimit)
			{
				tmpURL = `${tmpURL}/${tmpLimit}`;
			}
		}

		return tmpURL;
	};

	var Update = function(pParameters)
	{
		var tmpTableName = generateTableName(pParameters);
        var tmpFlags = generateFlags(pParameters);

        if (tmpTableName)
        {
            let tmpURL = tmpTableName;
            if (tmpFlags)
            {
                tmpURL = `${tmpURL}/WithFlags/${tmpFlags}`
            }
            return tmpURL;
        }
        else
        {
            return false;
        }
	};

	var Delete = function(pParameters)
	{
		var tmpTableName = generateTableName(pParameters);
		var tmpIDRecord = getIDRecord(pParameters);

        if (!tmpIDRecord)
        {
            return false;
        }

		return `${tmpTableName}/${tmpIDRecord}`;
	};

	var Count = function(pParameters)
	{
		var tmpTableName = generateTableName(pParameters);
		var tmpWhere = generateWhere(pParameters);

        let tmpCountQuery = `${tmpTableName}s/Count`;

        if (tmpWhere)
        {
            return `${tmpTableName}s/Count/FilteredTo/${tmpWhere}`;
        }

        return tmpCountQuery;
	};

	var tmpDialect = ({
		Create: Create,
		Read: Read,
		Update: Update,
		Delete: Delete,
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
			get: function() { return 'MeadowEndpoints'; },
			enumerable: true
		});

	return tmpDialect;
};

module.exports = FoxHoundDialectMeadowEndpoints;
