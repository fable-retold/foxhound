/**
* FoxHound Query Generation Library
* @license MIT
* @author Steven Velozo <steven@velozo.com>
*/

// Load our base parameters skeleton object
const baseParameters = require('./Parameters.js');

var FoxHound = function()
{
	function createNew(pFable, pFromParameters)
	{
		// If a valid Fable object isn't passed in, return a constructor
		if ((typeof(pFable) !== 'object') || !('fable' in pFable))
		{
			return {new: createNew};
		}

		var _Fable = pFable;

		// The default parameters config object, used as a template for all new
		// queries created from this query.
		var _DefaultParameters = (typeof(pFromParameters) === 'undefined') ? {} : pFromParameters;

		// The parameters config object for the current query.  This is the only
		// piece of internal state that is important to operation.
		/** @type {Record<string, any>} */
		var _Parameters = false;

		var _Dialects = require('./Foxhound-Dialects.js');

		// The unique identifier for a query
		var _UUID = _Fable.getUUID();

		// The log level, for debugging chattiness.
		var _LogLevel = 0;

		// The dialect to use when generating queries
		/** @type {Record<string, any>} */
		var _Dialect = false;

		/**
		* Clone the current FoxHound Query into a new Query object, copying all
		* parameters as the new default.  Clone also copies the log level.
		*
		* @method clone
		* @return {Object} Returns a cloned Query.  This is still chainable.
		*/
		var clone = function()
		{
			var tmpFoxHound = createNew(_Fable, baseParameters)
				.setScope(_Parameters.scope)
				.setBegin(_Parameters.begin)
				.setCap(_Parameters.cap);

			// Schema and the identity column are the only parts of a query that carry forward.
			tmpFoxHound.query.schema = _Parameters.query.schema;
			tmpFoxHound.query.defaultIdentifier = _Parameters.query.defaultIdentifier;

			if (_Parameters.dataElements)
			{
				tmpFoxHound.parameters.dataElements = _Parameters.dataElements.slice(); // Copy the array of dataElements
			}
			if (_Parameters.sort)
			{
				tmpFoxHound.parameters.sort = _Parameters.sort.slice(); // Copy the sort array.
				// TODO: Fix the side affect nature of these being objects in the array .. they are technically clones of the previous.
			}
			if (_Parameters.filter)
			{
				tmpFoxHound.parameters.filter = _Parameters.filter.slice(); // Copy the filter array.
				// TODO: Fix the side affect nature of these being objects in the array .. they are technically clones of the previous.
			}

			return tmpFoxHound;
		};


		/**
		* Reset the parameters of the FoxHound Query to the Default.  Default
		* parameters were set during object construction.
		*
		* @method resetParameters
		* @return {Object} Returns the current Query for chaining.
		*/
		var resetParameters = function()
		{
			_Parameters = _Fable.Utility.extend({}, baseParameters, _DefaultParameters);
			_Parameters.query = ({
				disableAutoIdentity: false,
				disableAutoDateStamp: false,
				disableAutoUserStamp: false,
				disableDeleteTracking: false,
				body: false,
				schema: false,   // The schema to intersect with our records
				defaultIdentifier: false, // The identity column, used to give paged reads a total order
				IDUser: 0,       // The user to stamp into records
				UUID: _Fable.getUUID(), // A UUID for this record
				records: false,  // The records to be created or changed
				parameters: {}
			});

			_Parameters.result = ({
				executed: false, // True once we've run a query.
				value: false,    // The return value of the last query run
				// Updated below due to changes in how Async.js responds to a false value here
				error: undefined // The error message of the last run query
			});

			return this;
		};
		resetParameters();

		/**
		* Reset the parameters of the FoxHound Query to the Default.  Default
		* parameters were set during object construction.
		*
		* @method mergeParameters
		* @param {Object} pFromParameters A Parameters Object to merge from
		* @return {Object} Returns the current Query for chaining.
		*/
		var mergeParameters = function(pFromParameters)
		{
			_Parameters = _Fable.Utility.extend({}, _Parameters, pFromParameters);
			return this;
		};


		/**
		* Set the the Logging level.
		*
		* The log levels are:
		*    0  -  Don't log anything
		*    1  -  Log queries
		*    2  -  Log queries and non-parameterized queries
		*    3  -  Log everything
		*
		* @method setLogLevel
		* @param {Number} pLogLevel The log level for our object
		* @return {Object} Returns the current Query for chaining.
		*/
		var setLogLevel = function(pLogLevel)
		{
			var tmpLogLevel = 0;

			if (typeof(pLogLevel) === 'number' && (pLogLevel % 1) === 0)
			{
				tmpLogLevel = pLogLevel;
			}

			_LogLevel = tmpLogLevel;

			return this;
		};


		/**
		* Set the Scope for the Query.  *Scope* is the source for the data being
		* pulled.  In TSQL this would be the _table_, whereas in MongoDB this
		* would be the _collection_.
		*
		* A scope can be either a string, or an array (for JOINs and such).
		*
		* @method setScope
		* @param {String} pScope A Scope for the Query.
		* @return {Object} Returns the current Query for chaining.
		*/
		var setScope = function(pScope)
		{
			/** @type {string} */
			var tmpScope = false;

			if (typeof(pScope) === 'string')
			{
				tmpScope = pScope;
			}
			else if (pScope !== false)
			{
				_Fable.log.error('Scope set failed.  You must pass in a string or array.', {queryUUID:_UUID, parameters:_Parameters, invalidScope:pScope});
			}

			_Parameters.scope = tmpScope;

			if (_LogLevel > 2)
			{
				_Fable.log.info('Scope set: '+tmpScope, {queryUUID:_UUID, parameters:_Parameters});
			}

			return this;
		};

		/**
		* Set whether the query returns DISTINCT results.
		* For count queries, returns the distinct for the selected fields, or all fields in the base table by default.
		*
		* @method setDistinct
		* @param {Boolean} pDistinct True if the query should be distinct.
		* @return {Object} Returns the current Query for chaining.
		*/
		var setDistinct = function(pDistinct)
		{
			_Parameters.distinct = !!pDistinct;

			if (_LogLevel > 2)
			{
				_Fable.log.info('Distinct set: '+_Parameters.distinct, {queryUUID:_UUID, parameters:_Parameters});
			}

			return this;
		};


		/**
		* Set the Data Elements for the Query.  *Data Elements* are the fields
		* being pulled by the query.  In TSQL this would be the _columns_,
		* whereas in MongoDB this would be the _fields_.
		*
		* The passed values can be either a string, or an array.
		*
		* @method setDataElements
		* @param {string | Array<string>} pDataElements The Data Element(s) for the Query.
		* @return {Object} Returns the current Query for chaining.
		*/
		var setDataElements = function(pDataElements)
		{
			/** @type {Array<string>} */
			var tmpDataElements = false;

			if (Array.isArray(pDataElements))
			{
				// TODO: Check each entry of the array are all strings
				tmpDataElements = pDataElements;
			}
			if (typeof(pDataElements) === 'string')
			{
				tmpDataElements = [pDataElements];
			}

			_Parameters.dataElements = tmpDataElements;

			if (_LogLevel > 2)
			{
				_Fable.log.info('Data Elements set', {queryUUID:_UUID, parameters:_Parameters});
			}

			return this;
		};


		/**
		* Set the sort data element
		*
		* The passed values can be either a string, an object or an array of objects.
		*
		* The Sort object has two values:
		* {Column:'Birthday', Direction:'Ascending'}
		*
		* @method setSort
		* @param {string | Array<Record<string, any>>} pSort The sort criteria(s) for the Query.
		* @return {Object} Returns the current Query for chaining.
		*/
		var setSort = function(pSort)
		{
			/** @type {Array<Record<string, any>>} */
			var tmpSort = false;

			if (Array.isArray(pSort))
			{
				// TODO: Check each entry of the array are all conformant sort objects
				tmpSort = pSort;
			}
			else if (typeof(pSort) === 'string')
			{
				// Default to ascending
				tmpSort = [{Column:pSort, Direction:'Ascending'}];
			}
			else if (typeof(pSort) === 'object')
			{
				// TODO: Check that this sort entry conforms to a sort entry
				tmpSort = [pSort];
			}

			_Parameters.sort = tmpSort;

			if (_LogLevel > 2)
			{
				_Fable.log.info('Sort set', {queryUUID:_UUID, parameters:_Parameters});
			}

			return this;
		};

		/**
		* Set the join data element
		*
		* The passed values can be either an object or an array of objects.
		*
		* The join object has four values:
		* {Type:'INNER JOIN', Table:'Test', From:'Test.ID', To:'Scope.IDItem'}
		*
		* @method setJoin
		* @param {Object} pJoin The join criteria(s) for the Query.
		* @return {Object} Returns the current Query for chaining.
		*/
		var setJoin = function(pJoin)
		{
			_Parameters.join = [];

			if (Array.isArray(pJoin))
			{
				pJoin.forEach(function(join)
				{
					addJoin(join.Table, join.From, join.To, join.Type);
				});
			}
			else if (typeof(pJoin) === 'object')
			{
				addJoin(pJoin.Table, pJoin.From, pJoin.To, pJoin.Type);
			}

			return this;
		};


		/**
		* Add a sort data element
		*
		* The passed values can be either a string, an object or an array of objects.
		*
		* The Sort object has two values:
		* {Column:'Birthday', Direction:'Ascending'}
		*
		* @method setSort
		* @param {string | Record<string, any>} pSort The sort criteria to add to the Query.
		* @return {Object} Returns the current Query for chaining.
		*/
		var addSort = function(pSort)
		{
			/** @type {Record<string, any>} */
			var tmpSort = false;

			if (typeof(pSort) === 'string')
			{
				// Default to ascending
				tmpSort = {Column:pSort, Direction:'Ascending'};
			}
			if (typeof(pSort) === 'object')
			{
				// TODO: Check that this sort entry conforms to a sort entry
				tmpSort = pSort;
			}

			if (!_Parameters.sort)
			{
				_Parameters.sort = [];
			}

			_Parameters.sort.push(tmpSort);

			if (_LogLevel > 2)
			{
				_Fable.log.info('Sort set', {queryUUID:_UUID, parameters:_Parameters});
			}

			return this;
		};


		/**
		* Set the the Begin index for the Query.  *Begin* is the index at which
		* a query should start returning rows.  In TSQL this would be the n
		* parameter of ```LIMIT 1,n```, whereas in MongoDB this would be the
		* n in ```skip(n)```.
		*
		* The passed value must be an Integer >= 0.
		*
		* @method setBegin
		* @param {number | boolean} pBeginAmount The index to begin returning Query data.
		* @return {Object} Returns the current Query for chaining.
		*/
		var setBegin = function(pBeginAmount)
		{
			/** @type {number} */
			var tmpBegin = false;

			// Test if it is an integer > -1
			// http://jsperf.com/numbers-and-integers
			if (typeof(pBeginAmount) === 'number' && (pBeginAmount % 1) === 0 && pBeginAmount >= 0)
			{
				tmpBegin = pBeginAmount;
			}
			else if (pBeginAmount !== false)
			{
				_Fable.log.error('Begin set failed; non-positive or non-numeric argument.', {queryUUID:_UUID, parameters:_Parameters, invalidBeginAmount:pBeginAmount});
			}

			_Parameters.begin = tmpBegin;

			if (_LogLevel > 2)
			{
				_Fable.log.info('Begin set: '+pBeginAmount, {queryUUID:_UUID, parameters:_Parameters});
			}

			return this;
		};


		/**
		* Set the the Cap for the Query.  *Cap* is the maximum number of records
		* a Query should return in a set.  In TSQL this would be the n
		* parameter of ```LIMIT n```, whereas in MongoDB this would be the
		* n in ```limit(n)```.
		*
		* The passed value must be an Integer >= 0.
		*
		* @method setCap
		* @param {number | boolean} pCapAmount The maximum records for the Query set.
		* @return {Object} Returns the current Query for chaining.
		*/
		var setCap = function(pCapAmount)
		{
			/** @type {number} */
			var tmpCapAmount = false;

			if (typeof(pCapAmount) === 'number' && (pCapAmount % 1) === 0 && pCapAmount >= 0)
			{
				tmpCapAmount = pCapAmount;
			}
			else if (pCapAmount !== false)
			{
				_Fable.log.error('Cap set failed; non-positive or non-numeric argument.', {queryUUID:_UUID, parameters:_Parameters, invalidCapAmount:pCapAmount});
			}


			_Parameters.cap = tmpCapAmount;

			if (_LogLevel > 2)
			{
				_Fable.log.info('Cap set to: '+tmpCapAmount, {queryUUID:_UUID, parameters:_Parameters});
			}

			return this;
		};


		/**
		* Set the filter expression
		*
		* The passed values can be either an object or an array of objects.
		*
		* The Filter object has a minimum of two values (which expands to the following):
		* {Column:'Name', Value:'John'}
		* {Column:'Name', Operator:'EQ', Value:'John', Connector:'And', Parameter:'Name'}
		*
		* @method setFilter
		* @param {Array<Record<string, any>>} pFilter The filter(s) for the Query.
		* @return {Object} Returns the current Query for chaining.
		*/
		var setFilter = function(pFilter)
		{
			/** @type {Record<string, any>} */
			var tmpFilter = false;

			if (Array.isArray(pFilter))
			{
				// TODO: Check each entry of the array are all conformant Filter objects
				tmpFilter = pFilter;
			}
			else if (typeof(pFilter) === 'object')
			{
				// TODO: Check that this Filter entry conforms to a Filter entry
				tmpFilter = [pFilter];
			}

			_Parameters.filter = tmpFilter;

			if (_LogLevel > 2)
			{
				_Fable.log.info('Filter set', {queryUUID:_UUID, parameters:_Parameters});
			}

			return this;
		};



		/**
		* Add a filter expression
		*
		* {Column:'Name', Operator:'EQ', Value:'John', Connector:'And', Parameter:'Name'}
		*
		* @method addFilter
		* @param {string} pColumn
		* @param {any} pValue
		* @param {string} [pOperator]
		* @param {string} [pConnector]
		* @param {string} [pParameter]
		* @return {Object} Returns the current Query for chaining.
		*/
		var addFilter = function(pColumn, pValue, pOperator, pConnector, pParameter)
		{
			if (typeof(pColumn) !== 'string')
			{
				_Fable.log.warn('Tried to add an invalid query filter column', {queryUUID:_UUID, parameters:_Parameters});
				return this;
			}
			if (typeof(pValue) === 'undefined')
			{
				_Fable.log.warn('Tried to add an invalid query filter value', {queryUUID:_UUID, parameters:_Parameters, invalidColumn:pColumn});
				return this;
			}
			var tmpOperator = (typeof(pOperator) === 'undefined') ? '=' : pOperator;
			var tmpConnector = (typeof(pConnector) === 'undefined') ? 'AND' : pConnector;
			var tmpParameter = (typeof(pParameter) === 'undefined') ? pColumn : pParameter;

			//support table.field notation (mysql2 requires this)
			tmpParameter = tmpParameter.replace('.', '_');

			var tmpFilter = (
				{
					Column: pColumn,
					Operator: tmpOperator,
					Value: pValue,
					Connector: tmpConnector,
					Parameter: tmpParameter
				});

			if (!Array.isArray(_Parameters.filter))
			{
				_Parameters.filter = [tmpFilter];
			}
			else
			{
				_Parameters.filter.push(tmpFilter);
			}

			if (_LogLevel > 2)
			{
				_Fable.log.info('Added a filter', {queryUUID:_UUID, parameters:_Parameters, newFilter:tmpFilter});
			}

			return this;
		};

		/**
		* Add a join expression
		*
		* {Type:'INNER JOIN', Table:'Test', From:'Test.ID', To:'Scope.IDItem'}
		*
		* @method addJoin
		* @return {Object} Returns the current Query for chaining.
		*/
		var addJoin = function(pTable, pFrom, pTo, pType)
		{
			if (typeof(pTable) !== 'string')
			{
				_Fable.log.warn('Tried to add an invalid query join table', {queryUUID:_UUID, parameters:_Parameters});
				return this;
			}
			if (typeof(pFrom) === 'undefined' || typeof(pTo) === 'undefined')
			{
				_Fable.log.warn('Tried to add an invalid query join field', {queryUUID:_UUID, parameters:_Parameters});
				return this;
			}
			//sanity check the join fields
			if (pFrom.indexOf(pTable)!=0)
			{
				_Fable.log.warn('Tried to add an invalid query join field, join must come FROM the join table!', {queryUUID:_UUID, parameters:_Parameters, invalidField:pFrom});
				return this;
			}
			if (pTo.indexOf('.')<=0)
			{
				_Fable.log.warn('Tried to add an invalid query join field, join must go TO a field on another table ([table].[field])!', {queryUUID:_UUID, parameters:_Parameters, invalidField:pTo});
				return this;
			}

			var tmpType = (typeof(pType) === 'undefined') ?  'INNER JOIN' : pType;

			var tmpJoin = (
				{
					Type: tmpType,
					Table: pTable,
					From: pFrom,
					To: pTo
				});

			if (!Array.isArray(_Parameters.join))
			{
				_Parameters.join = [tmpJoin];
			}
			else
			{
				_Parameters.join.push(tmpJoin);
			}

			if (_LogLevel > 2)
			{
				_Fable.log.info('Added a join', {queryUUID:_UUID, parameters:_Parameters});
			}

			return this;
		};



		/**
		* Add a record (for UPDATE and INSERT)
		*
		*
		* @method addRecord
		* @param {Object} pRecord The record to add.
		* @return {Object} Returns the current Query for chaining.
		*/
		var addRecord = function(pRecord)
		{
			if (typeof(pRecord) !== 'object')
			{
				_Fable.log.warn('Tried to add an invalid record to the query -- records must be an object', {queryUUID:_UUID, parameters:_Parameters});
				return this;
			}

			if (!Array.isArray(_Parameters.query.records))
			{
				_Parameters.query.records = [pRecord];
			}
			else
			{
				_Parameters.query.records.push(pRecord);
			}

			if (_LogLevel > 2)
			{
				_Fable.log.info('Added a record to the query', {queryUUID:_UUID, parameters:_Parameters, newRecord:pRecord});
			}

			return this;
		};



		/**
		* Set the Dialect for Query generation.
		*
		* This function expects a string, case sensitive, which matches both the
		* folder and filename
		*
		* @method setDialect
		* @param {String} pDialectName The dialect for query generation.
		* @return {Object} Returns the current Query for chaining.
		*/
		var setDialect = function(pDialectName)
		{

			if (typeof(pDialectName) !== 'string')
			{
				_Fable.log.warn('Dialect set to English - invalid name', {queryUUID:_UUID, parameters:_Parameters, invalidDialect:pDialectName});
				return setDialect('English');
			}

			if (_Dialects.hasOwnProperty(pDialectName))
			{
				_Dialect = _Dialects[pDialectName](_Fable);
				if (_LogLevel > 2)
				{
					_Fable.log.info('Dialog set to: '+pDialectName, {queryUUID:_UUID, parameters:_Parameters});
				}
			}
			else
			{
				_Fable.log.error('Dialect not set - unknown dialect "'+pDialectName+"'", {queryUUID:_UUID, parameters:_Parameters, invalidDialect:pDialectName});
				setDialect('English');
			}

			return this;
		};

		/**
		* User to use for this query
		*
		* @method setIDUser
		*/
		var setIDUser = function(pIDUser)
		{

			var tmpUserID = 0;

			if (typeof(pIDUser) === 'number' && (pIDUser % 1) === 0 && pIDUser >= 0)
			{
				tmpUserID = pIDUser;
			}
			else if (pIDUser !== false)
			{
				_Fable.log.error('User set failed; non-positive or non-numeric argument.', {queryUUID:_UUID, parameters:_Parameters, invalidIDUser:pIDUser});
			}


			_Parameters.userID = tmpUserID;
			_Parameters.query.IDUser = tmpUserID;

			if (_LogLevel > 2)
			{
				_Fable.log.info('IDUser set to: '+tmpUserID, {queryUUID:_UUID, parameters:_Parameters});
			}

			return this;
		};

		/**
		* Flag to disable auto identity
		*
		* @method setDisableAutoIdentity
		*/
		var setDisableAutoIdentity = function(pFlag)
		{
			_Parameters.query.disableAutoIdentity = pFlag;

			return this; //chainable
		};

		/**
		* Flag to disable auto datestamp
		*
		* @method setDisableAutoDateStamp
		*/
		var setDisableAutoDateStamp = function(pFlag)
		{
			_Parameters.query.disableAutoDateStamp = pFlag;

			return this; //chainable
		};

		/**
		* Flag to disable auto userstamp
		*
		* @method setDisableAutoUserStamp
		*/
		var setDisableAutoUserStamp = function(pFlag)
		{
			_Parameters.query.disableAutoUserStamp = pFlag;

			return this; //chainable
		};

		/**
		* Flag to disable delete tracking
		*
		* @method setDisableDeleteTracking
		*/
		var setDisableDeleteTracking = function(pFlag)
		{
			_Parameters.query.disableDeleteTracking = pFlag;

			return this; //chainable
		};

		/**
		* Check that a valid Dialect has been set
		*
		* If there has not been a dialect set, it defaults to English.
		* TODO: Have the json configuration define a "default" dialect.
		*
		* @method checkDialect
		*/
		var checkDialect = function()
		{
			if (_Dialect === false)
			{
				setDialect('English');
			}
		};


		var buildCreateQuery = function()
		{
			checkDialect();
			_Parameters.query.body = _Dialect.Create(_Parameters);
			return this;
		};

		var buildReadQuery = function()
		{
			checkDialect();
			_Parameters.query.body = _Dialect.Read(_Parameters);
			return this;
		};

		var buildUpdateQuery = function()
		{
			checkDialect();
			_Parameters.query.body = _Dialect.Update(_Parameters);
			return this;
		};

		var buildDeleteQuery = function()
		{
			checkDialect();
			_Parameters.query.body = _Dialect.Delete(_Parameters);
			return this;
		};

		var buildUndeleteQuery = function()
		{
			checkDialect();
			_Parameters.query.body = _Dialect.Undelete(_Parameters);
			return this;
		};

		var buildCountQuery = function()
		{
			checkDialect();
			_Parameters.query.body = _Dialect.Count(_Parameters);
			return this;
		};

		/**
		* Container Object for our Factory Pattern
		*/
		var tmpNewFoxHoundObject = (
		{
			resetParameters: resetParameters,
			mergeParameters: mergeParameters,

			setLogLevel: setLogLevel,

			setScope: setScope,
			setDistinct: setDistinct,
			setIDUser: setIDUser,
			setDataElements: setDataElements,
			setBegin: setBegin,
			setCap: setCap,
			setFilter: setFilter,
			addFilter: addFilter,
			setSort: setSort,
			addSort: addSort,
			setJoin: setJoin,
			addJoin: addJoin,

			addRecord: addRecord,
			setDisableAutoIdentity: setDisableAutoIdentity,
			setDisableAutoDateStamp: setDisableAutoDateStamp,
			setDisableAutoUserStamp: setDisableAutoUserStamp,
			setDisableDeleteTracking: setDisableDeleteTracking,

			setDialect: setDialect,

			buildCreateQuery: buildCreateQuery,
			buildReadQuery: buildReadQuery,
			buildUpdateQuery: buildUpdateQuery,
			buildDeleteQuery: buildDeleteQuery,
			buildUndeleteQuery: buildUndeleteQuery,
			buildCountQuery: buildCountQuery,

			clone: clone,
			new: createNew
		});

		/**
		 * Query
		 *
		 * @property query
		 * @type Object
		 */
		Object.defineProperty(tmpNewFoxHoundObject, 'query',
			{
				get: function() { return _Parameters.query; },
				set: function(pQuery) { _Parameters.query = pQuery; },
				enumerable: true
			});

		/**
		 * Query
		 *
		 * @property query
		 * @type Object
		 */
		Object.defineProperty(tmpNewFoxHoundObject, 'indexHints',
			{
				get: function() { return _Parameters.indexHints; },
				set: function(pHints) { _Parameters.indexHints = pHints; },
				enumerable: true,
			});

		/**
		 * Result
		 *
		 * @property result
		 * @type Object
		 */
		Object.defineProperty(tmpNewFoxHoundObject, 'result',
			{
				get: function() { return _Parameters.result; },
				set: function(pResult) { _Parameters.result = pResult; },
				enumerable: true
			});

		/**
		 * Query Parameters
		 *
		 * @property parameters
		 * @type Object
		 */
		Object.defineProperty(tmpNewFoxHoundObject, 'parameters',
			{
				get: function() { return _Parameters; },
				set: function(pParameters) { _Parameters = pParameters; },
				enumerable: true
			});

		/**
		 * Dialect
		 *
		 * @property dialect
		 * @type Object
		 * @return {Record<string, any>}
		 */
		Object.defineProperty(tmpNewFoxHoundObject, 'dialect',
			{
				get: function() { return _Dialect; },
				enumerable: true
			});

		/**
		 * Universally Unique Identifier
		 *
		 * @property uuid
		 * @type String
		 */
		Object.defineProperty(tmpNewFoxHoundObject, 'uuid',
			{
				get: function() { return _UUID; },
				enumerable: true
			});

		/**
		 * Log Level
		 *
		 * @property logLevel
		 * @type {number}
		 */
		Object.defineProperty(tmpNewFoxHoundObject, 'logLevel',
			{
				get: function() { return _LogLevel; },
				enumerable: true
			});

		return tmpNewFoxHoundObject;
	}

	return createNew();
};

module.exports = FoxHound();
