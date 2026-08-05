"use strict";

(function (f) {
  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = f();
  } else if (typeof define === "function" && define.amd) {
    define([], f);
  } else {
    var g;
    if (typeof window !== "undefined") {
      g = window;
    } else if (typeof global !== "undefined") {
      g = global;
    } else if (typeof self !== "undefined") {
      g = self;
    } else {
      g = this;
    }
    g.Foxhound = f();
  }
})(function () {
  var define, module, exports;
  return function () {
    function r(e, n, t) {
      function o(i, f) {
        if (!n[i]) {
          if (!e[i]) {
            var c = "function" == typeof require && require;
            if (!f && c) return c(i, !0);
            if (u) return u(i, !0);
            var a = new Error("Cannot find module '" + i + "'");
            throw a.code = "MODULE_NOT_FOUND", a;
          }
          var p = n[i] = {
            exports: {}
          };
          e[i][0].call(p.exports, function (r) {
            var n = e[i][1][r];
            return o(n || r);
          }, p, p.exports, r, e, n, t);
        }
        return n[i].exports;
      }
      for (var u = "function" == typeof require && require, i = 0; i < t.length; i++) o(t[i]);
      return o;
    }
    return r;
  }()({
    1: [function (require, module, exports) {
      /**
      * FoxHound Query Generation Library
      * @license MIT
      * @author Steven Velozo <steven@velozo.com>
      */

      // Load our base parameters skeleton object
      const baseParameters = require('./Parameters.js');
      var FoxHound = function FoxHound() {
        function createNew(pFable, pFromParameters) {
          // If a valid Fable object isn't passed in, return a constructor
          if (typeof pFable !== 'object' || !('fable' in pFable)) {
            return {
              new: createNew
            };
          }
          var _Fable = pFable;

          // The default parameters config object, used as a template for all new
          // queries created from this query.
          var _DefaultParameters = typeof pFromParameters === 'undefined' ? {} : pFromParameters;

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
          var clone = function clone() {
            var tmpFoxHound = createNew(_Fable, baseParameters).setScope(_Parameters.scope).setBegin(_Parameters.begin).setCap(_Parameters.cap);

            // Schema and the identity column are the only parts of a query that carry forward.
            tmpFoxHound.query.schema = _Parameters.query.schema;
            tmpFoxHound.query.defaultIdentifier = _Parameters.query.defaultIdentifier;
            if (_Parameters.dataElements) {
              tmpFoxHound.parameters.dataElements = _Parameters.dataElements.slice(); // Copy the array of dataElements
            }
            if (_Parameters.sort) {
              tmpFoxHound.parameters.sort = _Parameters.sort.slice(); // Copy the sort array.
              // TODO: Fix the side affect nature of these being objects in the array .. they are technically clones of the previous.
            }
            if (_Parameters.filter) {
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
          var resetParameters = function resetParameters() {
            _Parameters = _Fable.Utility.extend({}, baseParameters, _DefaultParameters);
            _Parameters.query = {
              disableAutoIdentity: false,
              disableAutoDateStamp: false,
              disableAutoUserStamp: false,
              disableDeleteTracking: false,
              body: false,
              schema: false,
              // The schema to intersect with our records
              defaultIdentifier: false,
              // The identity column, used to give paged reads a total order
              IDUser: 0,
              // The user to stamp into records
              UUID: _Fable.getUUID(),
              // A UUID for this record
              records: false,
              // The records to be created or changed
              parameters: {}
            };
            _Parameters.result = {
              executed: false,
              // True once we've run a query.
              value: false,
              // The return value of the last query run
              // Updated below due to changes in how Async.js responds to a false value here
              error: undefined // The error message of the last run query
            };
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
          var mergeParameters = function mergeParameters(pFromParameters) {
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
          var setLogLevel = function setLogLevel(pLogLevel) {
            var tmpLogLevel = 0;
            if (typeof pLogLevel === 'number' && pLogLevel % 1 === 0) {
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
          var setScope = function setScope(pScope) {
            /** @type {string} */
            var tmpScope = false;
            if (typeof pScope === 'string') {
              tmpScope = pScope;
            } else if (pScope !== false) {
              _Fable.log.error('Scope set failed.  You must pass in a string or array.', {
                queryUUID: _UUID,
                parameters: _Parameters,
                invalidScope: pScope
              });
            }
            _Parameters.scope = tmpScope;
            if (_LogLevel > 2) {
              _Fable.log.info('Scope set: ' + tmpScope, {
                queryUUID: _UUID,
                parameters: _Parameters
              });
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
          var setDistinct = function setDistinct(pDistinct) {
            _Parameters.distinct = !!pDistinct;
            if (_LogLevel > 2) {
              _Fable.log.info('Distinct set: ' + _Parameters.distinct, {
                queryUUID: _UUID,
                parameters: _Parameters
              });
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
          var setDataElements = function setDataElements(pDataElements) {
            /** @type {Array<string>} */
            var tmpDataElements = false;
            if (Array.isArray(pDataElements)) {
              // TODO: Check each entry of the array are all strings
              tmpDataElements = pDataElements;
            }
            if (typeof pDataElements === 'string') {
              tmpDataElements = [pDataElements];
            }
            _Parameters.dataElements = tmpDataElements;
            if (_LogLevel > 2) {
              _Fable.log.info('Data Elements set', {
                queryUUID: _UUID,
                parameters: _Parameters
              });
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
          var setSort = function setSort(pSort) {
            /** @type {Array<Record<string, any>>} */
            var tmpSort = false;
            if (Array.isArray(pSort)) {
              // TODO: Check each entry of the array are all conformant sort objects
              tmpSort = pSort;
            } else if (typeof pSort === 'string') {
              // Default to ascending
              tmpSort = [{
                Column: pSort,
                Direction: 'Ascending'
              }];
            } else if (typeof pSort === 'object') {
              // TODO: Check that this sort entry conforms to a sort entry
              tmpSort = [pSort];
            }
            _Parameters.sort = tmpSort;
            if (_LogLevel > 2) {
              _Fable.log.info('Sort set', {
                queryUUID: _UUID,
                parameters: _Parameters
              });
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
          var setJoin = function setJoin(pJoin) {
            _Parameters.join = [];
            if (Array.isArray(pJoin)) {
              pJoin.forEach(function (join) {
                addJoin(join.Table, join.From, join.To, join.Type);
              });
            } else if (typeof pJoin === 'object') {
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
          var addSort = function addSort(pSort) {
            /** @type {Record<string, any>} */
            var tmpSort = false;
            if (typeof pSort === 'string') {
              // Default to ascending
              tmpSort = {
                Column: pSort,
                Direction: 'Ascending'
              };
            }
            if (typeof pSort === 'object') {
              // TODO: Check that this sort entry conforms to a sort entry
              tmpSort = pSort;
            }
            if (!_Parameters.sort) {
              _Parameters.sort = [];
            }
            _Parameters.sort.push(tmpSort);
            if (_LogLevel > 2) {
              _Fable.log.info('Sort set', {
                queryUUID: _UUID,
                parameters: _Parameters
              });
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
          var setBegin = function setBegin(pBeginAmount) {
            /** @type {number} */
            var tmpBegin = false;

            // Test if it is an integer > -1
            // http://jsperf.com/numbers-and-integers
            if (typeof pBeginAmount === 'number' && pBeginAmount % 1 === 0 && pBeginAmount >= 0) {
              tmpBegin = pBeginAmount;
            } else if (pBeginAmount !== false) {
              _Fable.log.error('Begin set failed; non-positive or non-numeric argument.', {
                queryUUID: _UUID,
                parameters: _Parameters,
                invalidBeginAmount: pBeginAmount
              });
            }
            _Parameters.begin = tmpBegin;
            if (_LogLevel > 2) {
              _Fable.log.info('Begin set: ' + pBeginAmount, {
                queryUUID: _UUID,
                parameters: _Parameters
              });
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
          var setCap = function setCap(pCapAmount) {
            /** @type {number} */
            var tmpCapAmount = false;
            if (typeof pCapAmount === 'number' && pCapAmount % 1 === 0 && pCapAmount >= 0) {
              tmpCapAmount = pCapAmount;
            } else if (pCapAmount !== false) {
              _Fable.log.error('Cap set failed; non-positive or non-numeric argument.', {
                queryUUID: _UUID,
                parameters: _Parameters,
                invalidCapAmount: pCapAmount
              });
            }
            _Parameters.cap = tmpCapAmount;
            if (_LogLevel > 2) {
              _Fable.log.info('Cap set to: ' + tmpCapAmount, {
                queryUUID: _UUID,
                parameters: _Parameters
              });
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
          var setFilter = function setFilter(pFilter) {
            /** @type {Record<string, any>} */
            var tmpFilter = false;
            if (Array.isArray(pFilter)) {
              // TODO: Check each entry of the array are all conformant Filter objects
              tmpFilter = pFilter;
            } else if (typeof pFilter === 'object') {
              // TODO: Check that this Filter entry conforms to a Filter entry
              tmpFilter = [pFilter];
            }
            _Parameters.filter = tmpFilter;
            if (_LogLevel > 2) {
              _Fable.log.info('Filter set', {
                queryUUID: _UUID,
                parameters: _Parameters
              });
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
          var addFilter = function addFilter(pColumn, pValue, pOperator, pConnector, pParameter) {
            if (typeof pColumn !== 'string') {
              _Fable.log.warn('Tried to add an invalid query filter column', {
                queryUUID: _UUID,
                parameters: _Parameters
              });
              return this;
            }
            if (typeof pValue === 'undefined') {
              _Fable.log.warn('Tried to add an invalid query filter value', {
                queryUUID: _UUID,
                parameters: _Parameters,
                invalidColumn: pColumn
              });
              return this;
            }
            var tmpOperator = typeof pOperator === 'undefined' ? '=' : pOperator;
            var tmpConnector = typeof pConnector === 'undefined' ? 'AND' : pConnector;
            var tmpParameter = typeof pParameter === 'undefined' ? pColumn : pParameter;

            //support table.field notation (mysql2 requires this)
            tmpParameter = tmpParameter.replace('.', '_');
            var tmpFilter = {
              Column: pColumn,
              Operator: tmpOperator,
              Value: pValue,
              Connector: tmpConnector,
              Parameter: tmpParameter
            };
            if (!Array.isArray(_Parameters.filter)) {
              _Parameters.filter = [tmpFilter];
            } else {
              _Parameters.filter.push(tmpFilter);
            }
            if (_LogLevel > 2) {
              _Fable.log.info('Added a filter', {
                queryUUID: _UUID,
                parameters: _Parameters,
                newFilter: tmpFilter
              });
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
          var addJoin = function addJoin(pTable, pFrom, pTo, pType) {
            if (typeof pTable !== 'string') {
              _Fable.log.warn('Tried to add an invalid query join table', {
                queryUUID: _UUID,
                parameters: _Parameters
              });
              return this;
            }
            if (typeof pFrom === 'undefined' || typeof pTo === 'undefined') {
              _Fable.log.warn('Tried to add an invalid query join field', {
                queryUUID: _UUID,
                parameters: _Parameters
              });
              return this;
            }
            //sanity check the join fields
            if (pFrom.indexOf(pTable) != 0) {
              _Fable.log.warn('Tried to add an invalid query join field, join must come FROM the join table!', {
                queryUUID: _UUID,
                parameters: _Parameters,
                invalidField: pFrom
              });
              return this;
            }
            if (pTo.indexOf('.') <= 0) {
              _Fable.log.warn('Tried to add an invalid query join field, join must go TO a field on another table ([table].[field])!', {
                queryUUID: _UUID,
                parameters: _Parameters,
                invalidField: pTo
              });
              return this;
            }
            var tmpType = typeof pType === 'undefined' ? 'INNER JOIN' : pType;
            var tmpJoin = {
              Type: tmpType,
              Table: pTable,
              From: pFrom,
              To: pTo
            };
            if (!Array.isArray(_Parameters.join)) {
              _Parameters.join = [tmpJoin];
            } else {
              _Parameters.join.push(tmpJoin);
            }
            if (_LogLevel > 2) {
              _Fable.log.info('Added a join', {
                queryUUID: _UUID,
                parameters: _Parameters
              });
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
          var addRecord = function addRecord(pRecord) {
            if (typeof pRecord !== 'object') {
              _Fable.log.warn('Tried to add an invalid record to the query -- records must be an object', {
                queryUUID: _UUID,
                parameters: _Parameters
              });
              return this;
            }
            if (!Array.isArray(_Parameters.query.records)) {
              _Parameters.query.records = [pRecord];
            } else {
              _Parameters.query.records.push(pRecord);
            }
            if (_LogLevel > 2) {
              _Fable.log.info('Added a record to the query', {
                queryUUID: _UUID,
                parameters: _Parameters,
                newRecord: pRecord
              });
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
          var _setDialect = function setDialect(pDialectName) {
            if (typeof pDialectName !== 'string') {
              _Fable.log.warn('Dialect set to English - invalid name', {
                queryUUID: _UUID,
                parameters: _Parameters,
                invalidDialect: pDialectName
              });
              return _setDialect('English');
            }
            if (_Dialects.hasOwnProperty(pDialectName)) {
              _Dialect = _Dialects[pDialectName](_Fable);
              if (_LogLevel > 2) {
                _Fable.log.info('Dialog set to: ' + pDialectName, {
                  queryUUID: _UUID,
                  parameters: _Parameters
                });
              }
            } else {
              _Fable.log.error('Dialect not set - unknown dialect "' + pDialectName + "'", {
                queryUUID: _UUID,
                parameters: _Parameters,
                invalidDialect: pDialectName
              });
              _setDialect('English');
            }
            return this;
          };

          /**
          * User to use for this query
          *
          * @method setIDUser
          */
          var setIDUser = function setIDUser(pIDUser) {
            var tmpUserID = 0;
            if (typeof pIDUser === 'number' && pIDUser % 1 === 0 && pIDUser >= 0) {
              tmpUserID = pIDUser;
            } else if (pIDUser !== false) {
              _Fable.log.error('User set failed; non-positive or non-numeric argument.', {
                queryUUID: _UUID,
                parameters: _Parameters,
                invalidIDUser: pIDUser
              });
            }
            _Parameters.userID = tmpUserID;
            _Parameters.query.IDUser = tmpUserID;
            if (_LogLevel > 2) {
              _Fable.log.info('IDUser set to: ' + tmpUserID, {
                queryUUID: _UUID,
                parameters: _Parameters
              });
            }
            return this;
          };

          /**
          * Flag to disable auto identity
          *
          * @method setDisableAutoIdentity
          */
          var setDisableAutoIdentity = function setDisableAutoIdentity(pFlag) {
            _Parameters.query.disableAutoIdentity = pFlag;
            return this; //chainable
          };

          /**
          * Flag to disable auto datestamp
          *
          * @method setDisableAutoDateStamp
          */
          var setDisableAutoDateStamp = function setDisableAutoDateStamp(pFlag) {
            _Parameters.query.disableAutoDateStamp = pFlag;
            return this; //chainable
          };

          /**
          * Flag to disable auto userstamp
          *
          * @method setDisableAutoUserStamp
          */
          var setDisableAutoUserStamp = function setDisableAutoUserStamp(pFlag) {
            _Parameters.query.disableAutoUserStamp = pFlag;
            return this; //chainable
          };

          /**
          * Flag to disable delete tracking
          *
          * @method setDisableDeleteTracking
          */
          var setDisableDeleteTracking = function setDisableDeleteTracking(pFlag) {
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
          var checkDialect = function checkDialect() {
            if (_Dialect === false) {
              _setDialect('English');
            }
          };
          var buildCreateQuery = function buildCreateQuery() {
            checkDialect();
            _Parameters.query.body = _Dialect.Create(_Parameters);
            return this;
          };
          var buildReadQuery = function buildReadQuery() {
            checkDialect();
            _Parameters.query.body = _Dialect.Read(_Parameters);
            return this;
          };
          var buildUpdateQuery = function buildUpdateQuery() {
            checkDialect();
            _Parameters.query.body = _Dialect.Update(_Parameters);
            return this;
          };
          var buildDeleteQuery = function buildDeleteQuery() {
            checkDialect();
            _Parameters.query.body = _Dialect.Delete(_Parameters);
            return this;
          };
          var buildUndeleteQuery = function buildUndeleteQuery() {
            checkDialect();
            _Parameters.query.body = _Dialect.Undelete(_Parameters);
            return this;
          };
          var buildCountQuery = function buildCountQuery() {
            checkDialect();
            _Parameters.query.body = _Dialect.Count(_Parameters);
            return this;
          };

          /**
          * Container Object for our Factory Pattern
          */
          var tmpNewFoxHoundObject = {
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
            setDialect: _setDialect,
            buildCreateQuery: buildCreateQuery,
            buildReadQuery: buildReadQuery,
            buildUpdateQuery: buildUpdateQuery,
            buildDeleteQuery: buildDeleteQuery,
            buildUndeleteQuery: buildUndeleteQuery,
            buildCountQuery: buildCountQuery,
            clone: clone,
            new: createNew
          };

          /**
           * Query
           *
           * @property query
           * @type Object
           */
          Object.defineProperty(tmpNewFoxHoundObject, 'query', {
            get: function get() {
              return _Parameters.query;
            },
            set: function set(pQuery) {
              _Parameters.query = pQuery;
            },
            enumerable: true
          });

          /**
           * Query
           *
           * @property query
           * @type Object
           */
          Object.defineProperty(tmpNewFoxHoundObject, 'indexHints', {
            get: function get() {
              return _Parameters.indexHints;
            },
            set: function set(pHints) {
              _Parameters.indexHints = pHints;
            },
            enumerable: true
          });

          /**
           * Result
           *
           * @property result
           * @type Object
           */
          Object.defineProperty(tmpNewFoxHoundObject, 'result', {
            get: function get() {
              return _Parameters.result;
            },
            set: function set(pResult) {
              _Parameters.result = pResult;
            },
            enumerable: true
          });

          /**
           * Query Parameters
           *
           * @property parameters
           * @type Object
           */
          Object.defineProperty(tmpNewFoxHoundObject, 'parameters', {
            get: function get() {
              return _Parameters;
            },
            set: function set(pParameters) {
              _Parameters = pParameters;
            },
            enumerable: true
          });

          /**
           * Dialect
           *
           * @property dialect
           * @type Object
           * @return {Record<string, any>}
           */
          Object.defineProperty(tmpNewFoxHoundObject, 'dialect', {
            get: function get() {
              return _Dialect;
            },
            enumerable: true
          });

          /**
           * Universally Unique Identifier
           *
           * @property uuid
           * @type String
           */
          Object.defineProperty(tmpNewFoxHoundObject, 'uuid', {
            get: function get() {
              return _UUID;
            },
            enumerable: true
          });

          /**
           * Log Level
           *
           * @property logLevel
           * @type {number}
           */
          Object.defineProperty(tmpNewFoxHoundObject, 'logLevel', {
            get: function get() {
              return _LogLevel;
            },
            enumerable: true
          });
          return tmpNewFoxHoundObject;
        }
        return createNew();
      };
      module.exports = FoxHound();
    }, {
      "./Foxhound-Dialects.js": 2,
      "./Parameters.js": 3
    }],
    2: [function (require, module, exports) {
      let getDialects = () => {
        let tmpDialects = {};
        tmpDialects.English = require('./dialects/English/FoxHound-Dialect-English.js');
        tmpDialects.SQLite = require('./dialects/SQLite/FoxHound-Dialect-SQLite.js');
        tmpDialects.ALASQL = require('./dialects/ALASQL/FoxHound-Dialect-ALASQL.js');
        tmpDialects.MeadowEndpoints = require('./dialects/MeadowEndpoints/FoxHound-Dialect-MeadowEndpoints.js');
        tmpDialects.MySQL = require('./dialects/MySQL/FoxHound-Dialect-MySQL.js');
        tmpDialects.MSSQL = require('./dialects/MicrosoftSQL/FoxHound-Dialect-MSSQL.js');
        tmpDialects.PostgreSQL = require('./dialects/PostgreSQL/FoxHound-Dialect-PostgreSQL.js');
        tmpDialects.Oracle = require('./dialects/Oracle/FoxHound-Dialect-Oracle.js');
        tmpDialects.MongoDB = require('./dialects/MongoDB/FoxHound-Dialect-MongoDB.js');
        tmpDialects.DGraph = require('./dialects/DGraph/FoxHound-Dialect-DGraph.js');
        tmpDialects.Solr = require('./dialects/Solr/FoxHound-Dialect-Solr.js');
        tmpDialects.default = tmpDialects.English;
        return tmpDialects;
      };
      module.exports = getDialects();
    }, {
      "./dialects/ALASQL/FoxHound-Dialect-ALASQL.js": 4,
      "./dialects/DGraph/FoxHound-Dialect-DGraph.js": 5,
      "./dialects/English/FoxHound-Dialect-English.js": 6,
      "./dialects/MeadowEndpoints/FoxHound-Dialect-MeadowEndpoints.js": 7,
      "./dialects/MicrosoftSQL/FoxHound-Dialect-MSSQL.js": 8,
      "./dialects/MongoDB/FoxHound-Dialect-MongoDB.js": 9,
      "./dialects/MySQL/FoxHound-Dialect-MySQL.js": 10,
      "./dialects/Oracle/FoxHound-Dialect-Oracle.js": 11,
      "./dialects/PostgreSQL/FoxHound-Dialect-PostgreSQL.js": 12,
      "./dialects/SQLite/FoxHound-Dialect-SQLite.js": 13,
      "./dialects/Solr/FoxHound-Dialect-Solr.js": 14
    }],
    3: [function (require, module, exports) {
      /**
      * Query Parameters Object
      *
      * @class FoxHoundQueryParameters
      * @constructor
      */
      var FoxHoundQueryParameters = {
        scope: false,
        // STR: The scope of the data
        // TSQL: the "Table" or "View"
        // MongoDB: the "Collection"

        dataElements: false,
        // ARR of STR: The data elements to return
        // TSQL: the "Columns"
        // MongoDB: the "Fields"

        begin: false,
        // INT: Record index to start at
        // TSQL: n in LIMIT 1,n
        // MongoDB: n in Skip(n)

        cap: false,
        // INT: Maximum number of records to return
        // TSQL: n in LIMIT n
        // MongoDB: n in limit(n)

        // Serialization example for a query:
        // Take the filter and return an array of filter instructions
        // Basic instruction anatomy:
        //       INSTRUCTION~FIELD~OPERATOR~VALUE
        // FOP - Filter Open Paren
        //       FOP~~(~
        // FCP - Filter Close Paren
        //       FCP~~)~
        // FBV - Filter By Value
        //       FBV~Category~EQ~Books
        //       Possible comparisons:
        //       * EQ - Equals To (=)
        //       * NE - Not Equals To (!=)
        //       * GT - Greater Than (>)
        //       * GE - Greater Than or Equals To (>=)
        //       * LT - Less Than (<)
        //       * LE - Less Than or Equals To (<=)
        //       * LK - Like (Like)
        // FBL - Filter By List (value list, separated by commas)
        //       FBL~Category~EQ~Books,Movies
        // FSF - Filter Sort Field
        //       FSF~Category~ASC~0
        //       FSF~Category~DESC~0
        // FCC - Filter Constraint Cap (the limit of what is returned)
        //       FCC~~10~
        // FCB - Filter Constraint Begin (the zero-based start index of what is returned)
        //       FCB~~10~
        //
        // This means: FBV~Category~EQ~Books~FBV~PublishedYear~GT~2000~FSF~PublishedYear~DESC~0
        //             Filters down to ALL BOOKS PUBLISHED AFTER 2000 IN DESCENDING ORDER
        filter: false,
        // ARR of OBJ: Data filter expression list {Column:'Name', Operator:'EQ', Value:'John', Connector:'And', Parameter:'Name'}
        // TSQL: the WHERE clause
        // MongoDB: a find() expression

        sort: false,
        // ARR of OBJ: The sort order    {Column:'Birthday', Direction:'Ascending'}
        // TSQL: ORDER BY
        // MongoDB: sort()

        join: false,
        // ARR of OBJ: The join tables    {Type:'INNER JOIN', Table:'test', From: 'Test.ID', To: 'Scope.IDItem' }
        // TSQL: JOIN

        // Force a specific query to run regardless of above ... this is used to override the query generator.
        queryOverride: false,
        // Where the generated query goes
        query: false,
        /*
        	{
        		body: false,
        		schema: false,   // The schema to intersect with our records
        		defaultIdentifier: false, // The identity column, used to give paged reads a total order
        		IDUser: 0,       // The User ID to stamp into records
        		UUID: A_UUID,    // Some globally unique record id, different per cloned query.
        		records: false,  // The records to be created or changed
        		parameters: {}
        	}
        */

        indexHints: false,
        /*
        	['IndexName1', 'IndexName2'] // A list of index names to hint to the underlying provider, if supported
         */

        // Who is making the query
        userID: 0,
        // Where the query results are stuck
        result: false
        /*
        	{
        		executed: false, // True once we've run a query.
        		value: false,    // The return value of the last query run
        		error: false     // The error message of the last run query
        	}
        */
      };
      module.exports = FoxHoundQueryParameters;
    }, {}],
    4: [function (require, module, exports) {
      /**
      * FoxHound ALASQL Dialect
      *
      * @license MIT
      *
      * For an ALASQL query override:
      // An underscore template with the following values:
      //      <%= DataElements %> = Field1, Field2, Field3, Field4
      //      <%= Begin %>        = 0
      //      <%= Cap %>          = 10
      //      <%= Filter %>       = WHERE StartDate > :MyStartDate
      //      <%= Sort %>         = ORDER BY Field1
      // The values are empty strings if they aren't set.
      *
      * @author Steven Velozo <steven@velozo.com>
      * @class FoxHoundDialectALASQL
      */

      var FoxHoundDialectALASQL = function FoxHoundDialectALASQL(pFable) {
        //Request time from SQL server with microseconds resolution
        const SQL_NOW = "NOW(3)";
        let _Fable = pFable;

        /**
        * Generate a table name from the scope.
        *
        * Because ALASQL is all in-memory, and can be run in two modes (anonymous
        * working on arrays or table-based) we are going to make this a programmable
        * value.  Then we can share the code across both providers.
        *
        * @method: generateTableName
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table name clause
        */
        var generateTableName = function generateTableName(pParameters) {
          return ' ' + pParameters.scope;
        };

        /**
        * Escape columns, because ALASQL has more reserved KWs than most SQL dialects
        */
        var escapeColumn = (pColumn, pParameters) => {
          if (pColumn.indexOf('.') < 0) {
            return '`' + pColumn + '`';
          } else {
            // This could suck if the scope is not the same
            var tmpTableName = pParameters.scope;
            if (pColumn.indexOf(tmpTableName + '.') > -1) {
              return '`' + pColumn.replace(tmpTableName + '.', '') + '`';
            } else {
              // This doesn't work well but we'll try it.
              return '`' + pColumn + '`';
            }
          }
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
        var generateFieldList = function generateFieldList(pParameters, pIsForCountClause) {
          var tmpDataElements = pParameters.dataElements;
          if (!Array.isArray(tmpDataElements) || tmpDataElements.length < 1) {
            if (!pIsForCountClause) {
              return ' *';
            }
            // we need to list all of the table fields explicitly; get them from the schema
            const tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            if (tmpSchema.length < 1) {
              // this means we have no schema; returning an empty string here signals the calling code to handle this case
              return '';
            }
            const idColumn = tmpSchema.find(entry => entry.Type === 'AutoIdentity');
            if (!idColumn) {
              // this means there is no autoincrementing unique ID column; treat as above
              return '';
            }
            return " ".concat(idColumn.Column);
          }
          var tmpFieldList = ' ';
          for (var i = 0; i < tmpDataElements.length; i++) {
            if (i > 0) {
              tmpFieldList += ', ';
            }
            tmpFieldList += escapeColumn(tmpDataElements[i], pParameters);
          }
          return tmpFieldList;
        };
        var resolveJsonColumnPath = function resolveJsonColumnPath(pColumnName, pSchema) {
          if (!Array.isArray(pSchema) || pSchema.length < 1) return null;
          var tmpParts = pColumnName.replace(/`/g, '').replace(/"/g, '').split('.');
          for (var tmpStartIdx = 0; tmpStartIdx < Math.min(tmpParts.length - 1, 2); tmpStartIdx++) {
            var tmpBaseColumn = tmpParts[tmpStartIdx];
            for (var s = 0; s < pSchema.length; s++) {
              if (pSchema[s].Column === tmpBaseColumn && (pSchema[s].Type === 'JSON' || pSchema[s].Type === 'JSONProxy')) {
                var tmpActualColumn = pSchema[s].Type === 'JSONProxy' ? pSchema[s].StorageColumn : tmpBaseColumn;
                var tmpJsonPath = '$.' + tmpParts.slice(tmpStartIdx + 1).join('.');
                return {
                  column: tmpActualColumn,
                  path: tmpJsonPath
                };
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
        var generateWhere = function generateWhere(pParameters) {
          var tmpFilter = Array.isArray(pParameters.filter) ? pParameters.filter : [];
          var tmpTableName = generateTableName(pParameters).trim();
          if (!pParameters.query.disableDeleteTracking) {
            // Check if there is a Deleted column on the Schema. If so, we add this to the filters automatically (if not already present)
            var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            for (var i = 0; i < tmpSchema.length; i++) {
              // There is a schema entry for it.  Process it accordingly.
              var tmpSchemaEntry = tmpSchema[i];
              if (tmpSchemaEntry.Type === 'Deleted') {
                var tmpHasDeletedParameter = false;

                //first, check to see if filters are already looking for Deleted column
                if (tmpFilter.length > 0) {
                  for (var x = 0; x < tmpFilter.length; x++) {
                    if (tmpFilter[x].Column === tmpSchemaEntry.Column) {
                      tmpHasDeletedParameter = true;
                      break;
                    }
                  }
                }
                if (!tmpHasDeletedParameter) {
                  //if not, we need to add it
                  tmpFilter.push({
                    Column: tmpTableName + '.' + tmpSchemaEntry.Column,
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
          if (tmpFilter.length < 1) {
            return '';
          }
          var tmpWhere = ' WHERE';

          // This is used to disable the connectors for subsequent queries.
          // Only the open parenthesis operator uses this, currently.
          var tmpLastOperatorNoConnector = false;
          for (var i = 0; i < tmpFilter.length; i++) {
            if (tmpFilter[i].Connector != 'NONE' && tmpFilter[i].Operator != ')' && tmpWhere != ' WHERE' && tmpLastOperatorNoConnector == false) {
              tmpWhere += ' ' + tmpFilter[i].Connector;
            }
            tmpLastOperatorNoConnector = false;
            var tmpColumnParameter;
            if (tmpFilter[i].Operator === '(') {
              // Open a logical grouping
              tmpWhere += ' (';
              tmpLastOperatorNoConnector = true;
            } else if (tmpFilter[i].Operator === ')') {
              // Close a logical grouping
              tmpWhere += ' )';
            } else if (tmpFilter[i].Operator === 'IN') {
              tmpColumnParameter = tmpFilter[i].Parameter + '_w' + i;
              // Add the column name, operator and parameter name to the list of where value parenthetical
              tmpWhere += ' ' + escapeColumn(tmpFilter[i].Column, pParameters) + ' ' + tmpFilter[i].Operator + ' ( :' + tmpColumnParameter + ' )';
              pParameters.query.parameters[tmpColumnParameter] = tmpFilter[i].Value;
            } else if (tmpFilter[i].Operator === 'IS NOT NULL') {
              // IS NOT NULL is a special operator which doesn't require a value, or parameter
              tmpWhere += ' ' + escapeColumn(tmpFilter[i].Column, pParameters) + ' ' + tmpFilter[i].Operator;
            } else {
              tmpColumnParameter = tmpFilter[i].Parameter + '_w' + i;
              // Add the column name, operator and parameter name to the list of where value parenthetical
              tmpWhere += ' ' + escapeColumn(tmpFilter[i].Column, pParameters) + ' ' + tmpFilter[i].Operator + ' :' + tmpColumnParameter;
              pParameters.query.parameters[tmpColumnParameter] = tmpFilter[i].Value;
            }
          }
          return tmpWhere;
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
        var findIdentityColumn = function findIdentityColumn(pParameters) {
          var tmpQuery = pParameters.query && typeof pParameters.query === 'object' ? pParameters.query : {};
          var tmpSchema = Array.isArray(tmpQuery.schema) ? tmpQuery.schema : [];
          for (var i = 0; i < tmpSchema.length; i++) {
            if (tmpSchema[i].Type === 'AutoIdentity') {
              return tmpSchema[i].Column;
            }
          }
          if (typeof tmpQuery.defaultIdentifier === 'string' && tmpQuery.defaultIdentifier) {
            for (var j = 0; j < tmpSchema.length; j++) {
              if (tmpSchema[j].Column === tmpQuery.defaultIdentifier) {
                return tmpQuery.defaultIdentifier;
              }
            }
          }
          return null;
        };

        /**
        * Resolve the sort a capped read should actually run with.
        *
        * LIMIT/FETCH over a sort that isn't a total order has no defined paging
        * behavior: pages can overlap and drop rows.  Appending the identity column
        * makes the order total, so pages partition the result set.  A
        * caller-supplied sort still leads; the identity column only breaks ties.
        *
        * @method: resolveStableSort
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {Array} The sort array to emit
        */
        var resolveStableSort = function resolveStableSort(pParameters) {
          var tmpSort = Array.isArray(pParameters.sort) ? pParameters.sort.slice() : [];

          // Only paged reads need a total order.  DISTINCT rejects an ORDER BY
          // term that isn't in the select list, and a query override owns its own
          // clause placement (it may be grouping), so neither can take one.
          if (!pParameters.cap || pParameters.distinct || pParameters.queryOverride || pParameters.disableStableSort) {
            return tmpSort;
          }
          var tmpIdentityColumn = findIdentityColumn(pParameters);
          if (!tmpIdentityColumn) {
            return tmpSort;
          }
          for (var i = 0; i < tmpSort.length; i++) {
            if (String(tmpSort[i].Column).split('.').pop() === tmpIdentityColumn) {
              // Already a total order.
              return tmpSort;
            }
          }
          tmpSort.push({
            Column: tmpIdentityColumn,
            Direction: 'Ascending'
          });
          return tmpSort;
        };

        /**
        * Generate an ORDER BY clause from the sort array
        *
        * Each entry in the sort is an object like:
        * {Column:'Color',Direction:'Descending'}
        *
        * @method: generateOrderBy
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the field list clause
        */
        var generateOrderBy = function generateOrderBy(pParameters) {
          var tmpOrderBy = resolveStableSort(pParameters);
          if (!Array.isArray(tmpOrderBy) || tmpOrderBy.length < 1) {
            return '';
          }
          var tmpOrderClause = ' ORDER BY';
          for (var i = 0; i < tmpOrderBy.length; i++) {
            if (i > 0) {
              tmpOrderClause += ',';
            }
            tmpOrderClause += ' ' + escapeColumn(tmpOrderBy[i].Column, pParameters);
            if (tmpOrderBy[i].Direction == 'Descending') {
              tmpOrderClause += ' DESC';
            }
          }
          return tmpOrderClause;
        };

        /**
        * Generate the limit clause
        *
        * @method: generateLimit
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table name clause
        */
        var generateLimit = function generateLimit(pParameters) {
          if (!pParameters.cap) {
            return '';
          }
          var tmpLimit = ' LIMIT';
          // Cap is required for a limit clause.
          tmpLimit += ' ' + pParameters.cap;

          // If there is a begin record, we'll pass that in as well.
          if (pParameters.begin !== false) {
            tmpLimit += ' FETCH ' + pParameters.begin;
          }
          return tmpLimit;
        };

        /**
        * Generate the update SET clause
        *
        * @method: generateUpdateSetters
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table name clause
        */
        var generateUpdateSetters = function generateUpdateSetters(pParameters) {
          var tmpRecords = pParameters.query.records;
          // We need to tell the query not to generate improperly if there are no values to set.
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }

          // Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpUpdate = '';
          // If there is more than one record in records, we are going to ignore them for now.
          var tmpCurrentColumn = 0;
          for (var tmpColumn in tmpRecords[0]) {
            // No hash table yet, so, we will just linear search it for now.
            // This uses the schema to decide if we want to treat a column differently on insert
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                // There is a schema entry for it.  Process it accordingly.
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (pParameters.query.disableAutoUserStamp && tmpSchemaEntry.Type === 'UpdateIDUser') {
              // This is ignored if flag is set
              continue;
            }
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
              case 'CreateDate':
              case 'CreateIDUser':
              case 'DeleteDate':
              case 'DeleteIDUser':
                // These are all ignored on update
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            switch (tmpSchemaEntry.Type) {
              case 'UpdateDate':
                if (pParameters.query.disableAutoDateStamp) {
                  var tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                  tmpUpdate += ' ' + escapeColumn(tmpColumn, pParameters) + ' = :' + tmpColumnParameter;
                  pParameters.query.parameters[tmpColumnParameter] = tmpRecords[0][tmpColumn];
                } else {
                  tmpUpdate += ' ' + escapeColumn(tmpColumn, pParameters) + ' = NOW()';
                }
                break;
              case 'UpdateIDUser':
                // This is the user ID, which we hope is in the query.
                // This is how to deal with a normal column
                var tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + escapeColumn(tmpColumn, pParameters) + ' = :' + tmpColumnParameter;
                // Set the query parameter
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                break;
              case 'JSON':
                var tmpJSONUpdateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + tmpColumn + ' = :' + tmpJSONUpdateParam;
                pParameters.query.parameters[tmpJSONUpdateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                break;
              case 'JSONProxy':
                var tmpProxyUpdateParam = tmpSchemaEntry.StorageColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + tmpSchemaEntry.StorageColumn + ' = :' + tmpProxyUpdateParam;
                pParameters.query.parameters[tmpProxyUpdateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                break;
              default:
                var tmpColumnDefaultParameter = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + escapeColumn(tmpColumn, pParameters) + ' = :' + tmpColumnDefaultParameter;

                // Set the query parameter
                pParameters.query.parameters[tmpColumnDefaultParameter] = tmpRecords[0][tmpColumn];
                break;
            }

            // We use a number to make sure parameters are unique.
            tmpCurrentColumn++;
          }

          // We need to tell the query not to generate improperly if there are no values set.
          if (tmpUpdate === '') {
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
        var generateUpdateDeleteSetters = function generateUpdateDeleteSetters(pParameters) {
          if (pParameters.query.disableDeleteTracking) {
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
          var tmpSchemaEntry = {
            Type: 'Default'
          };
          for (var i = 0; i < tmpSchema.length; i++) {
            // There is a schema entry for it.  Process it accordingly.
            tmpSchemaEntry = tmpSchema[i];
            var tmpUpdateSql = null;
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpUpdateSql = ' ' + escapeColumn(tmpSchemaEntry.Column, pParameters) + ' = 1';
                tmpHasDeletedField = true; //this field is required in order for query to be built
                break;
              case 'DeleteDate':
                tmpUpdateSql = ' ' + escapeColumn(tmpSchemaEntry.Column, pParameters) + ' = NOW()';
                break;
              case 'UpdateDate':
                // Delete operation is an Update, so we should stamp the update time
                tmpUpdateSql = ' ' + escapeColumn(tmpSchemaEntry.Column, pParameters) + ' = NOW()';
                break;
              case 'DeleteIDUser':
                // This is the user ID, which we hope is in the query.
                // This is how to deal with a normal column
                var tmpColumnParameter = tmpSchemaEntry.Column + '_' + tmpCurrentColumn;
                tmpUpdateSql = ' ' + escapeColumn(tmpSchemaEntry.Column, pParameters) + ' = :' + tmpColumnParameter;
                // Set the query parameter
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                break;
              default:
                //DON'T allow update of other fields in this query
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            tmpUpdate += tmpUpdateSql;

            // We use a number to make sure parameters are unique.
            tmpCurrentColumn++;
          }

          // We need to tell the query not to generate improperly if there are no values set.
          if (!tmpHasDeletedField || tmpUpdate === '') {
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
        var generateUpdateUndeleteSetters = function generateUpdateUndeleteSetters(pParameters) {
          // Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCurrentColumn = 0;
          var tmpHasDeletedField = false;
          var tmpUpdate = '';
          // No hash table yet, so, we will just linear search it for now.
          // This uses the schema to decide if we want to treat a column differently on insert
          var tmpSchemaEntry = {
            Type: 'Default'
          };
          for (var i = 0; i < tmpSchema.length; i++) {
            // There is a schema entry for it.  Process it accordingly.
            tmpSchemaEntry = tmpSchema[i];
            var tmpUpdateSql = null;
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpUpdateSql = ' ' + escapeColumn(tmpSchemaEntry.Column, pParameters) + ' = 0';
                tmpHasDeletedField = true; //this field is required in order for query to be built
                break;
              case 'UpdateDate':
                // Delete operation is an Update, so we should stamp the update time
                tmpUpdateSql = ' ' + escapeColumn(tmpSchemaEntry.Column, pParameters) + ' = NOW()';
                break;
              case 'UpdateIDUser':
                // This is the user ID, which we hope is in the query.
                // This is how to deal with a normal column
                var tmpColumnParameter = tmpSchemaEntry.Column + '_' + tmpCurrentColumn;
                tmpUpdateSql = ' ' + escapeColumn(tmpSchemaEntry.Column, pParameters) + ' = :' + tmpColumnParameter;
                // Set the query parameter
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                break;
              default:
                //DON'T allow update of other fields in this query
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            tmpUpdate += tmpUpdateSql;

            // We use a number to make sure parameters are unique.
            tmpCurrentColumn++;
          }

          // We need to tell the query not to generate improperly if there are no values set.
          if (!tmpHasDeletedField || tmpUpdate === '') {
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
        var generateCreateSetValues = function generateCreateSetValues(pParameters) {
          var tmpRecords = pParameters.query.records;
          // We need to tell the query not to generate improperly if there are no values to set.
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }

          // Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCreateSet = '';
          // If there is more than one record in records, we are going to ignore them for now.
          var tmpCurrentColumn = 0;
          for (var tmpColumn in tmpRecords[0]) {
            // No hash table yet, so, we will just linear search it for now.
            // This uses the schema to decide if we want to treat a column differently on insert
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                // There is a schema entry for it.  Process it accordingly.
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (!pParameters.query.disableDeleteTracking) {
              if (tmpSchemaEntry.Type === 'DeleteDate' || tmpSchemaEntry.Type === 'DeleteIDUser') {
                // These are all ignored on insert (if delete tracking is enabled as normal)
                continue;
              }
            }
            if (tmpCurrentColumn > 0) {
              tmpCreateSet += ',';
            }

            //define a re-usable method for setting up field definitions in a default pattern
            var buildDefaultDefinition = function buildDefaultDefinition() {
              var tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
              tmpCreateSet += ' :' + tmpColumnParameter;
              // Set the query parameter
              pParameters.query.parameters[tmpColumnParameter] = tmpRecords[0][tmpColumn];
            };
            var tmpColumnParameter;
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
                if (pParameters.query.disableAutoIdentity) {
                  buildDefaultDefinition();
                } else {
                  // This is an autoidentity, so we don't parameterize it and just pass in NULL
                  tmpCreateSet += ' NULL';
                }
                break;
              case 'AutoGUID':
                if (pParameters.query.disableAutoIdentity) {
                  buildDefaultDefinition();
                } else if (tmpRecords[0][tmpColumn] && tmpRecords[0][tmpColumn].length >= 5 && tmpRecords[0][tmpColumn] !== '0x0000000000000000')
                  //stricture default
                  {
                    // Allow consumer to override AutoGUID
                    buildDefaultDefinition();
                  } else {
                  // This is an autoidentity, so we don't parameterize it and just pass in NULL
                  tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                  tmpCreateSet += ' :' + tmpColumnParameter;
                  // Set the query parameter
                  pParameters.query.parameters[tmpColumnParameter] = pParameters.query.UUID;
                }
                break;
              case 'UpdateDate':
              case 'CreateDate':
              case 'DeleteDate':
                if (pParameters.query.disableAutoDateStamp) {
                  buildDefaultDefinition();
                } else {
                  // This is an autoidentity, so we don't parameterize it and just pass in NULL
                  tmpCreateSet += ' NOW()';
                }
                break;
              case 'UpdateIDUser':
              case 'CreateIDUser':
              case 'DeleteIDUser':
                if (pParameters.query.disableAutoUserStamp) {
                  buildDefaultDefinition();
                } else {
                  // This is the user ID, which we hope is in the query.
                  // This is how to deal with a normal column
                  tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                  tmpCreateSet += ' :' + tmpColumnParameter;
                  // Set the query parameter
                  pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                }
                break;
              case 'JSON':
                var tmpJSONCreateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpCreateSet += ' :' + tmpJSONCreateParam;
                pParameters.query.parameters[tmpJSONCreateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                break;
              case 'JSONProxy':
                var tmpProxyCreateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpCreateSet += ' :' + tmpProxyCreateParam;
                pParameters.query.parameters[tmpProxyCreateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                break;
              default:
                buildDefaultDefinition();
                break;
            }

            // We use an appended number to make sure parameters are unique.
            tmpCurrentColumn++;
          }

          // We need to tell the query not to generate improperly if there are no values set.
          if (tmpCreateSet === '') {
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
        var generateCreateSetList = function generateCreateSetList(pParameters) {
          // The records were already validated by generateCreateSetValues
          var tmpRecords = pParameters.query.records;

          // Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCreateSet = '';
          // If there is more than one record in records, we are going to ignore them for now.
          for (var tmpColumn in tmpRecords[0]) {
            // No hash table yet, so, we will just linear search it for now.
            // This uses the schema to decide if we want to treat a column differently on insert
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                // There is a schema entry for it.  Process it accordingly.
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (!pParameters.query.disableDeleteTracking) {
              if (tmpSchemaEntry.Type === 'DeleteDate' || tmpSchemaEntry.Type === 'DeleteIDUser') {
                // These are all ignored on insert (if delete tracking is enabled as normal)
                continue;
              }
            }
            switch (tmpSchemaEntry.Type) {
              case 'JSON':
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' ' + tmpColumn;
                break;
              case 'JSONProxy':
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' ' + tmpSchemaEntry.StorageColumn;
                break;
              default:
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' ' + escapeColumn(tmpColumn, pParameters);
                break;
            }
          }
          return tmpCreateSet;
        };
        var Create = function Create(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpCreateSetList = generateCreateSetList(pParameters);
          var tmpCreateSetValues = generateCreateSetValues(pParameters);
          if (!tmpCreateSetValues) {
            return false;
          }
          return 'INSERT INTO' + tmpTableName + ' (' + tmpCreateSetList + ') VALUES (' + tmpCreateSetValues + ');';
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
        var Read = function Read(pParameters) {
          var tmpFieldList = generateFieldList(pParameters);
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpOrderBy = generateOrderBy(pParameters);
          var tmpLimit = generateLimit(pParameters);
          const tmpOptDistinct = pParameters.distinct ? ' DISTINCT' : '';
          if (pParameters.queryOverride) {
            try {
              var tmpQueryTemplate = _Fable.Utility.template(pParameters.queryOverride);
              return tmpQueryTemplate({
                FieldList: tmpFieldList,
                TableName: tmpTableName,
                Where: tmpWhere,
                OrderBy: tmpOrderBy,
                Limit: tmpLimit,
                Distinct: tmpOptDistinct,
                _Params: pParameters
              });
            } catch (pError) {
              // This pokemon is here to give us a convenient way of not throwing up totally if the query fails.
              console.log('Error with custom Read Query [' + pParameters.queryOverride + ']: ' + pError);
              return false;
            }
          }
          return "SELECT".concat(tmpOptDistinct).concat(tmpFieldList, " FROM").concat(tmpTableName).concat(tmpWhere).concat(tmpOrderBy).concat(tmpLimit, ";");
        };
        var Update = function Update(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpUpdateSetters = generateUpdateSetters(pParameters);
          if (!tmpUpdateSetters) {
            return false;
          }
          return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateSetters + tmpWhere + ';';
        };
        var Delete = function Delete(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpUpdateDeleteSetters = generateUpdateDeleteSetters(pParameters);
          if (tmpUpdateDeleteSetters) {
            //If it has a deleted bit, update it instead of actually deleting the record
            return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateDeleteSetters + tmpWhere + ';';
          } else {
            return 'DELETE FROM' + tmpTableName + tmpWhere + ';';
          }
        };
        var Undelete = function Undelete(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          let tmpDeleteTrackingState = pParameters.query.disableDeleteTracking;
          pParameters.query.disableDeleteTracking = true;
          var tmpWhere = generateWhere(pParameters);
          var tmpUpdateUndeleteSetters = generateUpdateUndeleteSetters(pParameters);
          pParameters.query.disableDeleteTracking = tmpDeleteTrackingState;
          if (tmpUpdateUndeleteSetters) {
            //If it has a deleted bit, update it instead of actually deleting the record
            return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateUndeleteSetters + tmpWhere + ';';
          } else {
            return 'SELECT NULL;';
          }
        };
        var Count = function Count(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          const tmpFieldList = pParameters.distinct ? generateFieldList(pParameters, true) : '*';

          // here, we ignore the distinct keyword if no fields have been specified and
          if (pParameters.distinct && tmpFieldList.length < 1) {
            console.warn('Distinct requested but no field list or schema are available, so not honoring distinct for count query.');
          }
          const tmpOptDistinct = pParameters.distinct && tmpFieldList.length > 0 ? 'DISTINCT' : '';
          if (pParameters.queryOverride) {
            try {
              var tmpQueryTemplate = _Fable.Utility.template(pParameters.queryOverride);
              return tmpQueryTemplate({
                FieldList: [],
                TableName: tmpTableName,
                Where: tmpWhere,
                OrderBy: '',
                Limit: '',
                Distinct: tmpOptDistinct,
                _Params: pParameters
              });
            } catch (pError) {
              // This pokemon is here to give us a convenient way of not throwing up totally if the query fails.
              console.log('Error with custom Count Query [' + pParameters.queryOverride + ']: ' + pError);
              return false;
            }
          }
          return "SELECT COUNT(".concat(tmpOptDistinct).concat(tmpFieldList || '*', ") AS RowCount FROM").concat(tmpTableName).concat(tmpWhere, ";");
        };
        var tmpDialect = {
          Create: Create,
          Read: Read,
          Update: Update,
          Delete: Delete,
          Undelete: Undelete,
          Count: Count
        };

        /**
        * Dialect Name
        *
        * @property name
        * @type string
        */
        Object.defineProperty(tmpDialect, 'name', {
          get: function get() {
            return 'ALASQL';
          },
          enumerable: true
        });
        return tmpDialect;
      };
      module.exports = FoxHoundDialectALASQL;
    }, {}],
    5: [function (require, module, exports) {
      /**
      * FoxHound DGraph Dialect
      *
      * Generates DQL query strings and JSON mutation descriptors for DGraph.
      * The query body is a JSON string; the parsed operation object is also
      * stored in query.parameters.dgraphOperation for direct provider consumption.
      *
      * @license MIT
      *
      * @author Steven Velozo <steven@velozo.com>
      * @class FoxHoundDialectDGraph
      */

      var FoxHoundDialectDGraph = function FoxHoundDialectDGraph(pFable) {
        let _Fable = pFable;

        /**
        * Strip any table-name prefix from a column name.
        * DGraph uses plain predicate names without table qualification.
        *
        * @method stripTablePrefix
        * @param {String} pColumn Column name, possibly table-qualified
        * @return {String} Plain column name
        */
        var stripTablePrefix = function stripTablePrefix(pColumn) {
          if (typeof pColumn !== 'string') {
            return pColumn;
          }
          // Remove backtick and double-quote quoting
          var tmpColumn = pColumn.replace(/[`"]/g, '');
          // Strip table prefix (e.g. "Animal.Name" -> "Name")
          if (tmpColumn.indexOf('.') >= 0) {
            var tmpParts = tmpColumn.split('.');
            if (tmpParts[tmpParts.length - 1] === '*') {
              return '*';
            }
            return tmpParts[tmpParts.length - 1];
          }
          return tmpColumn;
        };

        /**
        * Find the schema entry for a given column name.
        *
        * @method findSchemaEntry
        * @param {String} pColumn Column name
        * @param {Array} pSchema Schema array
        * @return {Object} Schema entry or default
        */
        var findSchemaEntry = function findSchemaEntry(pColumn, pSchema) {
          for (var i = 0; i < pSchema.length; i++) {
            if (pColumn == pSchema[i].Column) {
              return pSchema[i];
            }
          }
          return {
            Column: pColumn,
            Type: 'Default'
          };
        };

        /**
        * Format a value for inclusion in a DQL string.
        * Strings are double-quoted, numbers stay bare, arrays become bracketed.
        *
        * @method formatDGraphValue
        * @param {*} pValue The value to format
        * @return {String} Formatted value string
        */
        var _formatDGraphValue = function formatDGraphValue(pValue) {
          if (Array.isArray(pValue)) {
            var tmpItems = [];
            for (var i = 0; i < pValue.length; i++) {
              tmpItems.push(_formatDGraphValue(pValue[i]));
            }
            return '[' + tmpItems.join(', ') + ']';
          }
          if (typeof pValue === 'number') {
            return String(pValue);
          }
          if (typeof pValue === 'boolean') {
            return pValue ? 'true' : 'false';
          }
          // Escape double quotes inside strings
          return '"' + String(pValue).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
        };

        /**
        * Translate a single FoxHound filter entry into a DGraph DQL filter function call.
        *
        * @method translateOperator
        * @param {Object} pFilterEntry A FoxHound filter object
        * @return {String} DQL filter function string
        */
        var translateOperator = function translateOperator(pFilterEntry) {
          var tmpColumn = stripTablePrefix(pFilterEntry.Column);
          var tmpValue = pFilterEntry.Value;
          switch (pFilterEntry.Operator) {
            case '=':
              return 'eq(' + tmpColumn + ', ' + _formatDGraphValue(tmpValue) + ')';
            case '!=':
              return 'NOT eq(' + tmpColumn + ', ' + _formatDGraphValue(tmpValue) + ')';
            case '>':
              return 'gt(' + tmpColumn + ', ' + _formatDGraphValue(tmpValue) + ')';
            case '>=':
              return 'ge(' + tmpColumn + ', ' + _formatDGraphValue(tmpValue) + ')';
            case '<':
              return 'lt(' + tmpColumn + ', ' + _formatDGraphValue(tmpValue) + ')';
            case '<=':
              return 'le(' + tmpColumn + ', ' + _formatDGraphValue(tmpValue) + ')';
            case 'LIKE':
              // Convert SQL LIKE pattern to regex: % -> .*, _ -> .
              var tmpPattern = String(tmpValue).replace(/%/g, '.*').replace(/_/g, '.');
              return 'regexp(' + tmpColumn + ', /' + tmpPattern + '/i)';
            case 'IN':
              // DGraph eq() supports array values as IN
              var tmpInValues = Array.isArray(tmpValue) ? tmpValue : [tmpValue];
              return 'eq(' + tmpColumn + ', ' + _formatDGraphValue(tmpInValues) + ')';
            case 'NOT IN':
              var tmpNinValues = Array.isArray(tmpValue) ? tmpValue : [tmpValue];
              return 'NOT eq(' + tmpColumn + ', ' + _formatDGraphValue(tmpNinValues) + ')';
            case 'IS NULL':
              return 'NOT has(' + tmpColumn + ')';
            case 'IS NOT NULL':
              return 'has(' + tmpColumn + ')';
            default:
              // Unknown operator, treat as equality
              return 'eq(' + tmpColumn + ', ' + _formatDGraphValue(tmpValue) + ')';
          }
        };

        /**
        * Generate the DGraph @filter(...) clause from the FoxHound filter array.
        * Uses a stack-based approach for parenthetical groups.
        *
        * @method generateFilter
        * @param {Object} pParameters Query Parameters
        * @return {String} DQL @filter clause or empty string
        */
        var generateFilter = function generateFilter(pParameters) {
          var tmpFilter = Array.isArray(pParameters.filter) ? pParameters.filter.slice() : [];

          // Auto-add Deleted filter if applicable
          if (!pParameters.query.disableDeleteTracking) {
            var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpSchema[i].Type === 'Deleted') {
                var tmpHasDeletedParam = false;
                for (var x = 0; x < tmpFilter.length; x++) {
                  if (stripTablePrefix(tmpFilter[x].Column) === tmpSchema[i].Column) {
                    tmpHasDeletedParam = true;
                    break;
                  }
                }
                if (!tmpHasDeletedParam) {
                  tmpFilter.push({
                    Column: tmpSchema[i].Column,
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
          if (tmpFilter.length < 1) {
            return '';
          }

          // Stack-based processing for parenthetical groups
          // Each stack level is an array of { text: 'eq(...)', connector: 'AND' }
          var tmpStack = [[]];
          for (var i = 0; i < tmpFilter.length; i++) {
            var tmpEntry = tmpFilter[i];
            if (tmpEntry.Operator === '(') {
              tmpStack.push([]);
            } else if (tmpEntry.Operator === ')') {
              var tmpGroupConditions = tmpStack.pop();

              // Check if any condition inside the group used OR
              var tmpHasOR = false;
              for (var g = 0; g < tmpGroupConditions.length; g++) {
                if (tmpGroupConditions[g].connector === 'OR') {
                  tmpHasOR = true;
                  break;
                }
              }

              // Join conditions in the group
              var tmpGroupText = '';
              for (var g2 = 0; g2 < tmpGroupConditions.length; g2++) {
                if (g2 > 0) {
                  tmpGroupText += tmpHasOR ? ' OR ' : ' AND ';
                }
                tmpGroupText += tmpGroupConditions[g2].text;
              }
              tmpStack[tmpStack.length - 1].push({
                text: '(' + tmpGroupText + ')',
                connector: tmpEntry.Connector || 'AND'
              });
            } else {
              tmpStack[tmpStack.length - 1].push({
                text: translateOperator(tmpEntry),
                connector: tmpEntry.Connector || 'AND'
              });
            }
          }

          // Collapse root level
          var tmpRootConditions = tmpStack[0];
          if (tmpRootConditions.length === 0) {
            return '';
          }
          var tmpFilterText = '';
          for (var r = 0; r < tmpRootConditions.length; r++) {
            if (r > 0) {
              tmpFilterText += ' ' + tmpRootConditions[r].connector + ' ';
            }
            tmpFilterText += tmpRootConditions[r].text;
          }
          return ' @filter(' + tmpFilterText + ')';
        };

        /**
        * Generate the field list for a DQL query from dataElements.
        * Always includes uid. Falls back to all schema columns if no dataElements.
        *
        * @method generateFieldList
        * @param {Object} pParameters Query Parameters
        * @return {String} Space-separated field list
        */
        var generateFieldList = function generateFieldList(pParameters) {
          var tmpFields = ['uid'];
          var tmpDataElements = pParameters.dataElements;
          if (Array.isArray(tmpDataElements) && tmpDataElements.length > 0) {
            for (var i = 0; i < tmpDataElements.length; i++) {
              var tmpField = tmpDataElements[i];
              if (Array.isArray(tmpField)) {
                tmpField = tmpField[0];
              }
              tmpField = stripTablePrefix(tmpField);
              if (tmpField !== '*' && tmpFields.indexOf(tmpField) < 0) {
                tmpFields.push(tmpField);
              }
            }
          } else {
            // Use all schema columns
            var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            for (var j = 0; j < tmpSchema.length; j++) {
              var tmpCol = tmpSchema[j].Column;
              if (tmpFields.indexOf(tmpCol) < 0) {
                tmpFields.push(tmpCol);
              }
            }
          }

          // If we still only have uid, include dgraph.type for completeness
          if (tmpFields.length === 1) {
            tmpFields.push('dgraph.type');
          }
          return tmpFields.join(' ');
        };

        /**
        * Generate DQL sort parameters from sort array.
        *
        * @method generateSort
        * @param {Object} pParameters Query Parameters
        * @return {String} Sort parameters (e.g. "orderasc: Name") or empty string
        */
        var generateSort = function generateSort(pParameters) {
          var tmpSort = pParameters.sort;
          if (!Array.isArray(tmpSort) || tmpSort.length < 1) {
            return '';
          }
          var tmpParts = [];
          for (var i = 0; i < tmpSort.length; i++) {
            var tmpColumn = stripTablePrefix(tmpSort[i].Column);
            var tmpDir = tmpSort[i].Direction === 'Descending' ? 'orderdesc' : 'orderasc';
            tmpParts.push(tmpDir + ': ' + tmpColumn);
          }
          return tmpParts.join(', ');
        };

        /**
        * Generate DQL pagination parameters from begin/cap.
        *
        * @method generatePagination
        * @param {Object} pParameters Query Parameters
        * @return {String} Pagination parameters (e.g. "first: 10, offset: 5") or empty string
        */
        var generatePagination = function generatePagination(pParameters) {
          var tmpParts = [];
          if (pParameters.cap) {
            tmpParts.push('first: ' + pParameters.cap);
          }
          if (pParameters.begin !== false && pParameters.begin > 0) {
            tmpParts.push('offset: ' + pParameters.begin);
          }
          return tmpParts.join(', ');
        };

        /**
        * Generate the document for a create (mutation set) operation.
        * Walks the record through the schema to handle special column types.
        *
        * @method generateCreateDocument
        * @param {Object} pParameters Query Parameters
        * @return {Object|false} Document object or false if no record
        */
        var generateCreateDocument = function generateCreateDocument(pParameters) {
          var tmpRecords = pParameters.query.records;
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpDocument = {};
          for (var tmpColumn in tmpRecords[0]) {
            var tmpSchemaEntry = findSchemaEntry(tmpColumn, tmpSchema);
            if (!pParameters.query.disableDeleteTracking) {
              if (tmpSchemaEntry.Type === 'DeleteDate' || tmpSchemaEntry.Type === 'DeleteIDUser') {
                continue;
              }
            }
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
                if (pParameters.query.disableAutoIdentity) {
                  tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                } else {
                  tmpDocument[tmpColumn] = '$$AUTOINCREMENT';
                }
                break;
              case 'AutoGUID':
                if (pParameters.query.disableAutoIdentity) {
                  tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                } else if (tmpRecords[0][tmpColumn] && tmpRecords[0][tmpColumn].length >= 5 && tmpRecords[0][tmpColumn] !== '0x0000000000000000') {
                  tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                } else {
                  tmpDocument[tmpColumn] = pParameters.query.UUID;
                }
                break;
              case 'UpdateDate':
              case 'CreateDate':
                if (pParameters.query.disableAutoDateStamp) {
                  tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                } else {
                  tmpDocument[tmpColumn] = '$$NOW';
                }
                break;
              case 'DeleteIDUser':
              case 'UpdateIDUser':
              case 'CreateIDUser':
                if (pParameters.query.disableAutoUserStamp) {
                  tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                } else {
                  tmpDocument[tmpColumn] = pParameters.query.IDUser;
                }
                break;
              case 'Deleted':
                tmpDocument[tmpColumn] = 0;
                break;
              default:
                tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                break;
            }
          }
          if (Object.keys(tmpDocument).length === 0) {
            return false;
          }
          return tmpDocument;
        };

        /**
        * Generate the update fields for a mutation operation.
        * Walks the record through the schema, skipping identity/create/delete columns.
        *
        * @method generateUpdateDocument
        * @param {Object} pParameters Query Parameters
        * @return {Object|false} Update document or false if no record
        */
        var generateUpdateDocument = function generateUpdateDocument(pParameters) {
          var tmpRecords = pParameters.query.records;
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpUpdateDoc = {};
          for (var tmpColumn in tmpRecords[0]) {
            var tmpSchemaEntry = findSchemaEntry(tmpColumn, tmpSchema);
            if (pParameters.query.disableAutoUserStamp && tmpSchemaEntry.Type === 'UpdateIDUser') {
              continue;
            }
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
              case 'CreateDate':
              case 'CreateIDUser':
              case 'DeleteDate':
              case 'DeleteIDUser':
                continue;
            }
            switch (tmpSchemaEntry.Type) {
              case 'UpdateDate':
                if (pParameters.query.disableAutoDateStamp) {
                  tmpUpdateDoc[tmpColumn] = tmpRecords[0][tmpColumn];
                } else {
                  tmpUpdateDoc[tmpColumn] = '$$NOW';
                }
                break;
              case 'UpdateIDUser':
                tmpUpdateDoc[tmpColumn] = pParameters.query.IDUser;
                break;
              default:
                tmpUpdateDoc[tmpColumn] = tmpRecords[0][tmpColumn];
                break;
            }
          }
          if (Object.keys(tmpUpdateDoc).length === 0) {
            return false;
          }
          return tmpUpdateDoc;
        };

        /**
        * Generate the soft-delete setters.
        * Returns false if no Deleted column exists or delete tracking is disabled.
        *
        * @method generateDeleteSetters
        * @param {Object} pParameters Query Parameters
        * @return {Object|false} Delete setters or false
        */
        var generateDeleteSetters = function generateDeleteSetters(pParameters) {
          if (pParameters.query.disableDeleteTracking) {
            return false;
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpHasDeletedField = false;
          var tmpSetters = {};
          for (var i = 0; i < tmpSchema.length; i++) {
            var tmpSchemaEntry = tmpSchema[i];
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpSetters[tmpSchemaEntry.Column] = 1;
                tmpHasDeletedField = true;
                break;
              case 'DeleteDate':
                tmpSetters[tmpSchemaEntry.Column] = '$$NOW';
                break;
              case 'UpdateDate':
                tmpSetters[tmpSchemaEntry.Column] = '$$NOW';
                break;
              case 'DeleteIDUser':
                tmpSetters[tmpSchemaEntry.Column] = pParameters.query.IDUser;
                break;
              default:
                continue;
            }
          }
          if (!tmpHasDeletedField || Object.keys(tmpSetters).length === 0) {
            return false;
          }
          return tmpSetters;
        };

        /**
        * Generate the undelete setters.
        * Returns false if no Deleted column exists.
        *
        * @method generateUndeleteSetters
        * @param {Object} pParameters Query Parameters
        * @return {Object|false} Undelete setters or false
        */
        var generateUndeleteSetters = function generateUndeleteSetters(pParameters) {
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpHasDeletedField = false;
          var tmpSetters = {};
          for (var i = 0; i < tmpSchema.length; i++) {
            var tmpSchemaEntry = tmpSchema[i];
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpSetters[tmpSchemaEntry.Column] = 0;
                tmpHasDeletedField = true;
                break;
              case 'UpdateDate':
                tmpSetters[tmpSchemaEntry.Column] = '$$NOW';
                break;
              case 'UpdateIDUser':
                tmpSetters[tmpSchemaEntry.Column] = pParameters.query.IDUser;
                break;
              default:
                continue;
            }
          }
          if (!tmpHasDeletedField || Object.keys(tmpSetters).length === 0) {
            return false;
          }
          return tmpSetters;
        };

        /**
        * Build the func: arguments portion of a DQL query root.
        * Combines type filter, pagination, and sort.
        *
        * @method buildFuncArgs
        * @param {String} pType DGraph type name
        * @param {String} pPagination Pagination string
        * @param {String} pSort Sort string
        * @return {String} Func arguments (e.g. "func: type(Animal), first: 10, orderasc: Name")
        */
        var buildFuncArgs = function buildFuncArgs(pType, pPagination, pSort) {
          var tmpParts = ['func: type(' + pType + ')'];
          if (pPagination) {
            tmpParts.push(pPagination);
          }
          if (pSort) {
            tmpParts.push(pSort);
          }
          return tmpParts.join(', ');
        };

        /**
        * Create a new record
        *
        * @method Create
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor or false
        */
        var Create = function Create(pParameters) {
          var tmpDocument = generateCreateDocument(pParameters);
          if (!tmpDocument) {
            return false;
          }

          // Add DGraph type predicate
          tmpDocument['dgraph.type'] = pParameters.scope;

          // Determine if we need a counter scope for auto-increment
          var tmpCounterScope = false;
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          for (var i = 0; i < tmpSchema.length; i++) {
            if (tmpSchema[i].Type === 'AutoIdentity' && !pParameters.query.disableAutoIdentity) {
              tmpCounterScope = pParameters.scope + '.' + tmpSchema[i].Column;
              break;
            }
          }
          var tmpResult = {
            type: pParameters.scope,
            operation: 'mutate',
            mutationType: 'set',
            document: tmpDocument
          };
          if (tmpCounterScope) {
            tmpResult.counterScope = tmpCounterScope;
          }
          pParameters.query.parameters.dgraphOperation = tmpResult;
          return JSON.stringify(tmpResult);
        };

        /**
        * Read one or many records
        *
        * @method Read
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor
        */
        var Read = function Read(pParameters) {
          if (pParameters.join && Array.isArray(pParameters.join) && pParameters.join.length > 0) {
            _Fable.log.warn('DGraph dialect does not support JOINs; join parameter will be ignored.');
          }
          var tmpFilterClause = generateFilter(pParameters);
          var tmpFieldList = generateFieldList(pParameters);
          var tmpSort = generateSort(pParameters);
          var tmpPagination = generatePagination(pParameters);
          var tmpFuncArgs = buildFuncArgs(pParameters.scope, tmpPagination, tmpSort);
          var tmpDQL = '{ results(' + tmpFuncArgs + ')' + tmpFilterClause + ' { ' + tmpFieldList + ' } }';
          var tmpResult = {
            type: pParameters.scope,
            operation: 'query',
            query: tmpDQL,
            queryName: 'results'
          };
          if (pParameters.distinct) {
            tmpResult.distinct = true;
          }
          pParameters.query.parameters.dgraphOperation = tmpResult;
          return JSON.stringify(tmpResult);
        };

        /**
        * Update one or many records
        *
        * @method Update
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor or false
        */
        var Update = function Update(pParameters) {
          var tmpFilterClause = generateFilter(pParameters);
          var tmpUpdateDoc = generateUpdateDocument(pParameters);
          if (!tmpUpdateDoc) {
            return false;
          }

          // Build a DQL query to find the UIDs of matching nodes
          var tmpFuncArgs = buildFuncArgs(pParameters.scope, '', '');
          var tmpQueryForUIDs = '{ updateTargets(' + tmpFuncArgs + ')' + tmpFilterClause + ' { uid } }';
          var tmpResult = {
            type: pParameters.scope,
            operation: 'upsert',
            queryForUIDs: tmpQueryForUIDs,
            queryName: 'updateTargets',
            update: tmpUpdateDoc
          };
          pParameters.query.parameters.dgraphOperation = tmpResult;
          return JSON.stringify(tmpResult);
        };

        /**
        * Delete one or many records (soft or hard depending on schema)
        *
        * @method Delete
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor
        */
        var Delete = function Delete(pParameters) {
          var tmpDeleteSetters = generateDeleteSetters(pParameters);
          var tmpFilterClause = generateFilter(pParameters);

          // Build a DQL query to find the UIDs of matching nodes
          var tmpFuncArgs = buildFuncArgs(pParameters.scope, '', '');
          var tmpQueryForUIDs = '{ deleteTargets(' + tmpFuncArgs + ')' + tmpFilterClause + ' { uid } }';
          if (tmpDeleteSetters) {
            // Soft delete via mutation
            var tmpResult = {
              type: pParameters.scope,
              operation: 'upsert',
              queryForUIDs: tmpQueryForUIDs,
              queryName: 'deleteTargets',
              update: tmpDeleteSetters
            };
            pParameters.query.parameters.dgraphOperation = tmpResult;
            return JSON.stringify(tmpResult);
          } else {
            // Hard delete
            var tmpHardResult = {
              type: pParameters.scope,
              operation: 'delete',
              queryForUIDs: tmpQueryForUIDs,
              queryName: 'deleteTargets'
            };
            pParameters.query.parameters.dgraphOperation = tmpHardResult;
            return JSON.stringify(tmpHardResult);
          }
        };

        /**
        * Undelete (restore) a soft-deleted record
        *
        * @method Undelete
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor
        */
        var Undelete = function Undelete(pParameters) {
          var tmpUndeleteSetters = generateUndeleteSetters(pParameters);

          // Temporarily disable delete tracking for filter generation
          // so we can find records where Deleted=1
          var tmpDeleteTrackingState = pParameters.query.disableDeleteTracking;
          pParameters.query.disableDeleteTracking = true;
          var tmpFilterClause = generateFilter(pParameters);
          pParameters.query.disableDeleteTracking = tmpDeleteTrackingState;
          if (tmpUndeleteSetters) {
            var tmpFuncArgs = buildFuncArgs(pParameters.scope, '', '');
            var tmpQueryForUIDs = '{ undeleteTargets(' + tmpFuncArgs + ')' + tmpFilterClause + ' { uid } }';
            var tmpResult = {
              type: pParameters.scope,
              operation: 'upsert',
              queryForUIDs: tmpQueryForUIDs,
              queryName: 'undeleteTargets',
              update: tmpUndeleteSetters
            };
            pParameters.query.parameters.dgraphOperation = tmpResult;
            return JSON.stringify(tmpResult);
          } else {
            // No-op -- can't undelete without a Deleted column
            var tmpNoopResult = {
              type: pParameters.scope,
              operation: 'noop'
            };
            pParameters.query.parameters.dgraphOperation = tmpNoopResult;
            return JSON.stringify(tmpNoopResult);
          }
        };

        /**
        * Count records
        *
        * @method Count
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor
        */
        var Count = function Count(pParameters) {
          var tmpFilterClause = generateFilter(pParameters);
          var tmpFuncArgs = buildFuncArgs(pParameters.scope, '', '');
          var tmpDQL = '{ results(' + tmpFuncArgs + ')' + tmpFilterClause + ' { total: count(uid) } }';
          var tmpResult = {
            type: pParameters.scope,
            operation: 'query',
            query: tmpDQL,
            queryName: 'results',
            isCount: true
          };
          if (pParameters.distinct) {
            tmpResult.distinct = true;
            var tmpDataElements = pParameters.dataElements;
            if (Array.isArray(tmpDataElements) && tmpDataElements.length > 0) {
              var tmpFields = [];
              for (var i = 0; i < tmpDataElements.length; i++) {
                var tmpField = Array.isArray(tmpDataElements[i]) ? tmpDataElements[i][0] : tmpDataElements[i];
                tmpField = stripTablePrefix(tmpField);
                if (tmpField !== '*') {
                  tmpFields.push(tmpField);
                }
              }
              if (tmpFields.length > 0) {
                tmpResult.distinctFields = tmpFields;
              }
            } else {
              // Fall back to AutoIdentity column from schema
              var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
              for (var j = 0; j < tmpSchema.length; j++) {
                if (tmpSchema[j].Type === 'AutoIdentity') {
                  tmpResult.distinctFields = [tmpSchema[j].Column];
                  break;
                }
              }
            }
          }
          pParameters.query.parameters.dgraphOperation = tmpResult;
          return JSON.stringify(tmpResult);
        };
        var tmpDialect = {
          Create: Create,
          Read: Read,
          Update: Update,
          Delete: Delete,
          Undelete: Undelete,
          Count: Count
        };

        /**
        * Dialect Name
        *
        * @property name
        * @type string
        */
        Object.defineProperty(tmpDialect, 'name', {
          get: function get() {
            return 'DGraph';
          },
          enumerable: true
        });
        return tmpDialect;
      };
      module.exports = FoxHoundDialectDGraph;
    }, {}],
    6: [function (require, module, exports) {
      /**
      * FoxHound English Dialect
      *
      * Because if I can't ask for it in my native tongue, how am I going to ask a
      * complicated server for it?
      *
      * @license MIT
      *
      * @author Steven Velozo <steven@velozo.com>
      * @class FoxHoundDialectEnglish
      */
      var FoxHoundDialectEnglish = function FoxHoundDialectEnglish() {
        var Create = function Create(pParameters) {
          var tmpScope = pParameters.scope;
          return 'Here is a ' + tmpScope + '.';
        };

        /**
        * Read one or many records
        *
        * Some examples:
        * Please give me all your Widget records.  Thanks.
        * Please give me 20 Widget records.  Thanks.
        * Please give me 20 Widget records starting with record 5.  Thanks.
        * Please give me the ID, Name and Cost of 20 Widget records starting with record 5.  Thanks.
        * Please give me the ID and Name of 20 Widget records starting with record 5, when LastName equals "Smith".  Thanks.
        *
        * @method Read
        * @param {Number} pLogLevel The log level for our object
        * @return {String} Returns the current Query for chaining.
        */
        var Read = function Read(pParameters) {
          var tmpScope = pParameters.scope;
          const tmpDistinct = pParameters.distinct ? 'unique ' : '';
          return "Please give me all your ".concat(tmpDistinct).concat(tmpScope, " records.  Thanks.");
        };
        var Update = function Update(pParameters) {
          var tmpScope = pParameters.scope;
          return 'I am changing your ' + tmpScope + '.';
        };
        var Delete = function Delete(pParameters) {
          var tmpScope = pParameters.scope;
          return 'I am deleting your ' + tmpScope + '.';
        };
        var Undelete = function Undelete(pParameters) {
          var tmpScope = pParameters.scope;
          return 'I am undeleting your ' + tmpScope + '.';
        };
        var Count = function Count(pParameters) {
          var tmpScope = pParameters.scope;
          const tmpDistinct = pParameters.distinct ? 'unique ' : '';
          return "Count your ".concat(tmpDistinct).concat(tmpScope, ".");
        };
        var tmpDialect = {
          Create: Create,
          Read: Read,
          Update: Update,
          Delete: Delete,
          Undelete: Undelete,
          Count: Count
        };

        /**
         * Dialect Name
         *
         * @property name
         * @type string
         */
        Object.defineProperty(tmpDialect, 'name', {
          get: function get() {
            return 'English';
          },
          enumerable: true
        });
        return tmpDialect;
      };
      module.exports = FoxHoundDialectEnglish;
    }, {}],
    7: [function (require, module, exports) {
      /**
      * FoxHound Meadow Endpoints Dialect
      *
      * @license MIT
      *
      * @author Steven Velozo <steven@velozo.com>
      * @class FoxHoundDialectMeadowEndpoints
      */

      var FoxHoundDialectMeadowEndpoints = function FoxHoundDialectMeadowEndpoints() {
        /**
         * Generate a table name from the scope
         *
         * @method: generateTableName
         * @param {Object} pParameters SQL Query Parameters
         * @return {String} Returns the table name clause
         */
        var generateTableName = function generateTableName(pParameters) {
          return pParameters.scope;
        };

        /**
         * Generate the Identity column from the schema or scope
         * 
         * @method: generateIdentityColumnName
         * @param {Object} pParameters SQL Query Parameters
         * @return {String} Returns the table name clause
         */
        var generateIdentityColumnName = function generateIdentityColumnName(pParameters) {
          // TODO: See about using the Schema or the Schemata for this
          return "ID".concat(pParameters.scope);
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
        var generateFieldList = function generateFieldList(pParameters) {
          var tmpDataElements = pParameters.dataElements;
          if (!Array.isArray(tmpDataElements) || tmpDataElements.length < 1) {
            return '';
          }
          var tmpFieldList = '';
          for (var i = 0; i < tmpDataElements.length; i++) {
            if (i > 0) {
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
        var generateWhere = function generateWhere(pParameters) {
          var tmpFilter = Array.isArray(pParameters.filter) ? pParameters.filter : [];
          var tmpTableName = generateTableName(pParameters);
          var tmpURL = '';
          let tmpfAddFilter = (pFilterCommand, pFilterParameters) => {
            if (tmpURL.length > 0) {
              tmpURL += '~';
            }
            tmpURL += "".concat(pFilterCommand, "~").concat(pFilterParameters[0], "~").concat(pFilterParameters[1], "~").concat(pFilterParameters[2]);
          };
          let tmpfTranslateOperator = pOperator => {
            let tmpNewOperator = 'EQ';
            switch (pOperator.toUpperCase()) {
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
                tmpNewOperator = 'NI';
                break;
            }
            return tmpNewOperator;
          };

          // Translating Delete Tracking bit on query to a query with automagic
          // This will eventually deprecate this as part of the necessary query
          if (pParameters.query.disableDeleteTracking) {
            tmpfAddFilter('FBV', ['Deleted', 'GE', '0']);
          }
          for (var i = 0; i < tmpFilter.length; i++) {
            if (tmpFilter[i].Operator === '(') {
              tmpfAddFilter('FOP', ['0', '(', '0']);
            } else if (tmpFilter[i].Operator === ')') {
              // Close a logical grouping
              tmpfAddFilter('FCP', ['0', ')', '0']);
            } else if (tmpFilter[i].Operator === 'IN' || tmpFilter[i].Operator === "NOT IN") {
              let tmpFilterCommand = 'FBV';
              if (tmpFilter[i].Connector == 'OR') {
                tmpFilterCommand = 'FBVOR';
              }
              // Add the column name, operator and parameter name to the list of where value parenthetical
              tmpfAddFilter(tmpFilterCommand, [tmpFilter[i].Column, tmpfTranslateOperator(tmpFilter[i].Operator), tmpFilter[i].Value.map(encodeURIComponent).join(',')]);
            } else if (tmpFilter[i].Operator === 'IS NULL') {
              // IS NULL is a special operator which doesn't require a value, or parameter
              tmpfAddFilter('FBV', [tmpFilter[i].Column, 'IN', '0']);
            } else if (tmpFilter[i].Operator === 'IS NOT NULL') {
              // IS NOT NULL is a special operator which doesn't require a value, or parameter
              tmpfAddFilter('FBV', [tmpFilter[i].Column, 'NN', '0']);
            } else {
              let tmpFilterCommand = 'FBV';
              if (tmpFilter[i].Connector == 'OR') {
                tmpFilterCommand = 'FBVOR';
              }
              // Add the column name, operator and parameter name to the list of where value parenthetical
              tmpfAddFilter(tmpFilterCommand, [tmpFilter[i].Column, tmpfTranslateOperator(tmpFilter[i].Operator), encodeURIComponent(tmpFilter[i].Value)]);
            }
          }
          let tmpOrderBy = generateOrderBy(pParameters);
          if (tmpOrderBy) {
            if (tmpURL) {
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
        function generateFlags(pParameters) {
          let tmpDisableAutoDateStamp = pParameters.query.disableAutoDateStamp;
          let tmpDisableDeleteTracking = pParameters.query.disableDeleteTracking;
          let tmpDisableAutoIdentity = pParameters.query.disableAutoIdentity;
          let tmpDisableAutoUserStamp = pParameters.query.disableAutoUserStamp;
          let tmpFlags = '';
          let fAddFlag = (pFlagSet, pFlag) => {
            if (pFlagSet) {
              if (tmpFlags.length > 0) {
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
        }
        ;

        /**
        * Get the ID for the record, to be used in URIs
        *
        * @method: getIDRecord
        * @param {Object} pParameters SQL Query Parameters
        * @return {String} ID of the record in string form for the URI
        */
        var getIDRecord = function getIDRecord(pParameters) {
          var tmpFilter = Array.isArray(pParameters.filter) ? pParameters.filter : [];
          var tmpIDRecord = false;
          if (tmpFilter.length < 1) {
            return tmpIDRecord;
          }
          for (var i = 0; i < tmpFilter.length; i++) {
            // Check Schema Entry Type
            var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            var tmpSchemaEntry = {
              Column: tmpFilter[i].Column,
              Type: 'Default'
            };
            for (var j = 0; j < tmpSchema.length; j++) {
              // If this column is the AutoIdentity, set it.
              if (tmpFilter[i].Column == tmpSchema[j].Column && tmpSchema[j].Type == 'AutoIdentity') {
                tmpIDRecord = tmpFilter[i].Value;
                break;
              }
            }
          }
          return tmpIDRecord;
        };

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
        var generateOrderBy = function generateOrderBy(pParameters) {
          var tmpOrderBy = pParameters.sort;
          /** @type {string} */
          var tmpOrderClause = null;
          if (!Array.isArray(tmpOrderBy) || tmpOrderBy.length < 1) {
            return tmpOrderClause;
          }
          tmpOrderClause = '';
          for (var i = 0; i < tmpOrderBy.length; i++) {
            if (i > 0) {
              tmpOrderClause += '~';
            }
            tmpOrderClause += "FSF~".concat(tmpOrderBy[i].Column, "~");
            if (tmpOrderBy[i].Direction == 'Descending') {
              tmpOrderClause += 'DESC~0';
            } else {
              tmpOrderClause += 'ASC~0';
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
        var generateLimit = function generateLimit(pParameters) {
          if (!pParameters.cap) {
            return '';
          }
          let tmpBegin = pParameters.begin !== false ? pParameters.begin : 0;
          return "".concat(tmpBegin, "/").concat(pParameters.cap);
        };
        var Create = function Create(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpFlags = generateFlags(pParameters);
          if (tmpTableName) {
            let tmpURL = tmpTableName;
            if (tmpFlags) {
              tmpURL = "".concat(tmpURL, "/WithFlags/").concat(tmpFlags);
            }
            return tmpURL;
          } else {
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
        var Read = function Read(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpFieldList = generateFieldList(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpLimit = generateLimit(pParameters);
          var tmpURL = "".concat(tmpTableName);
          // In the case that there is only a single query parameter, and the parameter is a single identity, 
          // we will cast it to the READ endpoint rather than READS.
          if (pParameters.filter && pParameters.filter.length == 1
          // If there is exactly one query filter parameter
          && pParameters.filter[0].Column === generateIdentityColumnName(pParameters)
          // AND It is the Identity column
          && pParameters.filter[0].Operator === '='
          // AND The comparators is a simple equals 
          && tmpLimit == '' && tmpFieldList == ''
          // AND There is no limit or field list set
          && !pParameters.sort)
            // AND There is no sort clause
            {
              // THEN This is a SINGLE READ by presumption.
              // There are some bad side affects this could cause with chaining and overridden behaviors, if 
              // we are requesting a filtered list of 1 record.
              tmpURL = "".concat(tmpURL, "/").concat(pParameters.filter[0].Value);
            } else {
            tmpURL = "".concat(tmpURL, "s");
            if (tmpFieldList) {
              tmpURL = "".concat(tmpURL, "/LiteExtended/").concat(tmpFieldList);
            }
            if (tmpWhere) {
              tmpURL = "".concat(tmpURL, "/FilteredTo/").concat(tmpWhere);
            }
            if (tmpLimit) {
              tmpURL = "".concat(tmpURL, "/").concat(tmpLimit);
            }
          }
          return tmpURL;
        };
        var Update = function Update(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpFlags = generateFlags(pParameters);
          if (tmpTableName) {
            let tmpURL = tmpTableName;
            if (tmpFlags) {
              tmpURL = "".concat(tmpURL, "/WithFlags/").concat(tmpFlags);
            }
            return tmpURL;
          } else {
            return false;
          }
        };
        var Delete = function Delete(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpIDRecord = getIDRecord(pParameters);
          if (!tmpIDRecord) {
            return false;
          }
          return "".concat(tmpTableName, "/").concat(tmpIDRecord);
        };
        var Count = function Count(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          let tmpCountQuery = "".concat(tmpTableName, "s/Count");
          if (tmpWhere) {
            return "".concat(tmpTableName, "s/Count/FilteredTo/").concat(tmpWhere);
          }
          return tmpCountQuery;
        };
        var tmpDialect = {
          Create: Create,
          Read: Read,
          Update: Update,
          Delete: Delete,
          Count: Count
        };

        /**
         * Dialect Name
         *
         * @property name
         * @type string
         */
        Object.defineProperty(tmpDialect, 'name', {
          get: function get() {
            return 'MeadowEndpoints';
          },
          enumerable: true
        });
        return tmpDialect;
      };
      module.exports = FoxHoundDialectMeadowEndpoints;
    }, {}],
    8: [function (require, module, exports) {
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

      var FoxHoundDialectMSSQL = function FoxHoundDialectMSSQL(pFable) {
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
        var generateTableName = function generateTableName(pParameters) {
          // Every Foxhound query has a table name; this puts it on here even if there are no columns
          // Which occurs when you generate a query like SELECT COUNT(*) FROM SomeTable;
          if (!pParameters.query.hasOwnProperty('parameterTypes')) {
            pParameters.query.parameterTypes = {};
          }
          return ' [' + pParameters.scope + ']';
        };
        var generateMSSQLParameterTypeEntry = function generateMSSQLParameterTypeEntry(pParameters, pColumnParameterName, pColumn) {
          // Lazily create the parameterTypes object if it doesn't exist
          if (!pParameters.query.hasOwnProperty('parameterTypes')) {
            pParameters.query.parameterTypes = {};
          }
          // Find the column parameter type for our prepared statement
          let tmpColumnParameterTypeString = 'VarChar';
          if (typeof pColumn == 'object') {
            // See if it has a type, set the type string
            tmpColumnParameterTypeString = pColumn.Type;
          } else if (typeof pColumn == 'string') {
            var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            for (let i = 0; i < tmpSchema.length; i++) {
              if (tmpSchema[i].Column == pColumn) {
                tmpColumnParameterTypeString = tmpSchema[i].Type;
                break;
              }
            }
          } else {
            _Fable.log.warn("Meadow MSSQL query attempted to add a parameter type but no valid column schema entry object or column name was passed; parameter name ".concat(pColumnParameterName, "."));
          }
          if (tmpColumnParameterTypeString == null || tmpColumnParameterTypeString == undefined) {
            return false;
          }
          switch (tmpColumnParameterTypeString) {
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
        var generateFieldList = function generateFieldList(pParameters, pIsForCountClause) {
          var tmpDataElements = pParameters.dataElements;
          if (!Array.isArray(tmpDataElements) || tmpDataElements.length < 1) {
            const tmpTableName = generateTableName(pParameters);
            if (!pIsForCountClause) {
              return tmpTableName + '.*';
            }
            // we need to list all of the table fields explicitly; get them from the schema
            const tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            if (tmpSchema.length < 1) {
              // this means we have no schema; returning an empty string here signals the calling code to handle this case
              return '';
            }
            const idColumn = tmpSchema.find(entry => entry.Type === 'AutoIdentity');
            if (!idColumn) {
              // this means there is no autoincrementing unique ID column; treat as above
              return '';
            }
            const qualifiedIDColumn = "".concat(idColumn.Column);
            return " ".concat(generateSafeFieldName(qualifiedIDColumn));
          }
          var tmpFieldList = ' ';
          for (var i = 0; i < tmpDataElements.length; i++) {
            if (i > 0) {
              tmpFieldList += ', ';
            }
            if (Array.isArray(tmpDataElements[i])) {
              tmpFieldList += generateSafeFieldName(tmpDataElements[i][0]);
              if (tmpDataElements[i].length > 1 && tmpDataElements[i][1]) {
                tmpFieldList += " AS " + generateSafeFieldName(tmpDataElements[i][1]);
              }
            } else {
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
        var generateOuterFieldListForLegacyPagination = function generateOuterFieldListForLegacyPagination(pParameters) {
          var tmpDataElements = pParameters.dataElements;
          if (Array.isArray(tmpDataElements) && tmpDataElements.length > 0) {
            // Reuse the caller-supplied list.  It emits unqualified column
            // names ([Col], [Col] AS [Alias]) which resolve fine against
            // the subquery alias.
            return generateFieldList(pParameters);
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          if (tmpSchema.length > 0) {
            var tmpList = ' ';
            for (var i = 0; i < tmpSchema.length; i++) {
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
        var generateSafeFieldName = function generateSafeFieldName(pFieldName) {
          // This isn't great but best we can do for MS SQL needing brackets around field names for reserved keywords
          if (pFieldName != '*' && pFieldName.indexOf('[') < 0 && pFieldName.indexOf('.') < 0) {
            return '[' + pFieldName + ']';
          } else {
            return pFieldName;
          }
        };
        var resolveJsonColumnPath = function resolveJsonColumnPath(pColumnName, pSchema) {
          if (!Array.isArray(pSchema) || pSchema.length < 1) return null;
          var tmpParts = pColumnName.replace(/`/g, '').replace(/"/g, '').split('.');
          for (var tmpStartIdx = 0; tmpStartIdx < Math.min(tmpParts.length - 1, 2); tmpStartIdx++) {
            var tmpBaseColumn = tmpParts[tmpStartIdx];
            for (var s = 0; s < pSchema.length; s++) {
              if (pSchema[s].Column === tmpBaseColumn && (pSchema[s].Type === 'JSON' || pSchema[s].Type === 'JSONProxy')) {
                var tmpActualColumn = pSchema[s].Type === 'JSONProxy' ? pSchema[s].StorageColumn : tmpBaseColumn;
                var tmpJsonPath = '$.' + tmpParts.slice(tmpStartIdx + 1).join('.');
                return {
                  column: tmpActualColumn,
                  path: tmpJsonPath
                };
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
        var generateWhere = function generateWhere(pParameters) {
          var tmpFilter = Array.isArray(pParameters.filter) ? pParameters.filter : [];
          var tmpTableName = generateTableName(pParameters);
          if (!pParameters.query.disableDeleteTracking) {
            // Check if there is a Deleted column on the Schema. If so, we add this to the filters automatically (if not already present)
            var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            for (var i = 0; i < tmpSchema.length; i++) {
              // There is a schema entry for it.  Process it accordingly.
              var tmpSchemaEntry = tmpSchema[i];
              if (tmpSchemaEntry.Type === 'Deleted') {
                var tmpHasDeletedParameter = false;

                //first, check to see if filters are already looking for Deleted column
                if (tmpFilter.length > 0) {
                  for (var x = 0; x < tmpFilter.length; x++) {
                    if (tmpFilter[x].Column === tmpSchemaEntry.Column) {
                      tmpHasDeletedParameter = true;
                      break;
                    }
                  }
                }
                if (!tmpHasDeletedParameter) {
                  //if not, we need to add it
                  tmpFilter.push({
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
          if (tmpFilter.length < 1) {
            return '';
          }
          var tmpWhere = ' WHERE';

          // This is used to disable the connectors for subsequent queries.
          // Only the open parenthesis operator uses this, currently.
          var tmpLastOperatorNoConnector = false;
          for (var i = 0; i < tmpFilter.length; i++) {
            if (tmpFilter[i].Connector != 'NONE' && tmpFilter[i].Operator != ')' && tmpWhere != ' WHERE' && tmpLastOperatorNoConnector == false) {
              tmpWhere += ' ' + tmpFilter[i].Connector;
            }
            tmpLastOperatorNoConnector = false;
            var tmpColumnParameter;
            if (tmpFilter[i].Operator === '(') {
              // Open a logical grouping
              tmpWhere += ' (';
              tmpLastOperatorNoConnector = true;
            } else if (tmpFilter[i].Operator === ')') {
              // Close a logical grouping
              tmpWhere += ' )';
            } else if (tmpFilter[i].Operator === 'IN' || tmpFilter[i].Operator === "NOT IN") {
              tmpColumnParameter = tmpFilter[i].Parameter + '_w' + i;
              // Add the column name, operator and parameter name to the list of where value parenthetical
              tmpWhere += ' [' + tmpFilter[i].Column + '] ' + tmpFilter[i].Operator + ' ( @' + tmpColumnParameter + ' )';
              pParameters.query.parameters[tmpColumnParameter] = tmpFilter[i].Value;
              // Find the column in the schema
              generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpFilter[i].Parameter);
            } else if (tmpFilter[i].Operator === 'IS NULL') {
              // IS NULL is a special operator which doesn't require a value, or parameter
              tmpWhere += ' [' + tmpFilter[i].Column + '] ' + tmpFilter[i].Operator;
            } else if (tmpFilter[i].Operator === 'IS NOT NULL') {
              // IS NOT NULL is a special operator which doesn't require a value, or parameter
              tmpWhere += ' [' + tmpFilter[i].Column + '] ' + tmpFilter[i].Operator;
            } else {
              tmpColumnParameter = tmpFilter[i].Parameter + '_w' + i;
              var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
              var tmpJsonRef = resolveJsonColumnPath(tmpFilter[i].Column, tmpSchema);
              if (tmpJsonRef) {
                tmpWhere += ' JSON_VALUE([' + tmpJsonRef.column + "], '" + tmpJsonRef.path + "') " + tmpFilter[i].Operator + ' :' + tmpColumnParameter;
              } else {
                tmpWhere += ' [' + tmpFilter[i].Column + '] ' + tmpFilter[i].Operator + ' @' + tmpColumnParameter;
              }
              pParameters.query.parameters[tmpColumnParameter] = tmpFilter[i].Value;
              generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpFilter[i].Parameter);
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
        var findPrimaryKeyColumn = function findPrimaryKeyColumn(pParameters) {
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          for (var i = 0; i < tmpSchema.length; i++) {
            if (tmpSchema[i].Type === 'AutoIdentity') {
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
        var findIdentityColumn = function findIdentityColumn(pParameters) {
          var tmpQuery = pParameters.query && typeof pParameters.query === 'object' ? pParameters.query : {};
          var tmpSchema = Array.isArray(tmpQuery.schema) ? tmpQuery.schema : [];
          for (var i = 0; i < tmpSchema.length; i++) {
            if (tmpSchema[i].Type === 'AutoIdentity') {
              return tmpSchema[i].Column;
            }
          }
          if (typeof tmpQuery.defaultIdentifier === 'string' && tmpQuery.defaultIdentifier) {
            for (var j = 0; j < tmpSchema.length; j++) {
              if (tmpSchema[j].Column === tmpQuery.defaultIdentifier) {
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
        var resolveStableSort = function resolveStableSort(pParameters) {
          var tmpSort = Array.isArray(pParameters.sort) ? pParameters.sort.slice() : [];

          // Only paged reads need a total order.  DISTINCT rejects an ORDER BY
          // term that isn't in the select list, and a query override owns its own
          // clause placement (it may be grouping), so neither can take one.
          if (!pParameters.cap || pParameters.distinct || pParameters.queryOverride || pParameters.disableStableSort) {
            return tmpSort;
          }
          var tmpIdentityColumn = findIdentityColumn(pParameters);
          if (!tmpIdentityColumn) {
            return tmpSort;
          }
          for (var i = 0; i < tmpSort.length; i++) {
            if (String(tmpSort[i].Column).split('.').pop() === tmpIdentityColumn) {
              // Already a total order.
              return tmpSort;
            }
          }
          tmpSort.push({
            Column: tmpIdentityColumn,
            Direction: 'Ascending'
          });
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
        var generateOrderBy = function generateOrderBy(pParameters) {
          var tmpOrderBy = resolveStableSort(pParameters);
          if (!Array.isArray(tmpOrderBy) || tmpOrderBy.length < 1) {
            if (pParameters.cap) {
              return ' ORDER BY (SELECT 1)';
            }
            return '';
          }
          var tmpOrderClause = ' ORDER BY';
          for (var i = 0; i < tmpOrderBy.length; i++) {
            if (i > 0) {
              tmpOrderClause += ',';
            }
            tmpOrderClause += ' [' + tmpOrderBy[i].Column + ']';
            if (tmpOrderBy[i].Direction == 'Descending') {
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
        var generateLimit = function generateLimit(pParameters) {
          if (!pParameters.cap) {
            return '';
          }
          if (pParameters.legacyPagination) {
            // The Read function wraps the query in a ROW_NUMBER() subquery
            // instead of appending an OFFSET/FETCH tail clause.
            return '';
          }
          var tmpLimit = ' OFFSET ';
          // If there is a begin record, we'll pass that in as well.
          if (pParameters.begin !== false) {
            tmpLimit += pParameters.begin;
          } else {
            tmpLimit += '0';
          }
          // Cap is required for a limit clause.
          tmpLimit += " ROWS FETCH NEXT ".concat(pParameters.cap, " ROWS ONLY");
          return tmpLimit;
        };

        /**
        * Generate the an index hinting clause
        *
        * @method: generateIndexHints
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table index hint clause
        */
        var generateIndexHints = function generateIndexHints(pParameters) {
          if (!Array.isArray(pParameters.indexHints) || pParameters.indexHints.length < 1) {
            return '';
          }
          return " WITH(INDEX(".concat(pParameters.indexHints.join(','), "))");
        };

        /**
        * Generate the join clause
        *
        * @method: generateJoins
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the join clause
        */
        var generateJoins = function generateJoins(pParameters) {
          var tmpJoins = pParameters.join;
          if (!Array.isArray(tmpJoins) || tmpJoins.length < 1) {
            return '';
          }
          var tmpJoinClause = ''; //ex. ' INNER JOIN';
          for (var i = 0; i < tmpJoins.length; i++) {
            var join = tmpJoins[i];
            //verify that all required fields are valid
            if (join.Type && join.Table && join.From && join.To) {
              tmpJoinClause += " ".concat(join.Type, " [").concat(join.Table, "] ON ").concat(join.From, " = ").concat(join.To);
            }
          }
          return tmpJoinClause;
        };

        /**
        * Generate the update SET clause
        *
        * @method: generateUpdateSetters
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table name clause
        */
        var generateUpdateSetters = function generateUpdateSetters(pParameters) {
          var tmpRecords = pParameters.query.records;
          // We need to tell the query not to generate improperly if there are no values to set.
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }

          // Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpUpdate = '';
          // If there is more than one record in records, we are going to ignore them for now.
          var tmpCurrentColumn = 0;
          for (var tmpColumn in tmpRecords[0]) {
            // No hash table yet, so, we will just linear search it for now.
            // This uses the schema to decide if we want to treat a column differently on insert
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
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
            if (pParameters.query.disableAutoUserStamp && tmpSchemaEntry.Type === 'UpdateIDUser') {
              // This is ignored if flag is set
              continue;
            }
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
              case 'CreateDate':
              case 'CreateIDUser':
              case 'DeleteDate':
              case 'DeleteIDUser':
                // These are all ignored on update
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            switch (tmpSchemaEntry.Type) {
              case 'UpdateDate':
                // This is an autoidentity, so we don't parameterize it and just pass in NULL
                if (pParameters.query.disableAutoDateStamp) {
                  var tmpColumnParameter = 'MANUAL_UpdateDate';
                  tmpUpdate += ' [' + tmpColumn + '] = @MANUAL_UpdateDate';
                  pParameters.query.parameters[tmpColumnParameter] = tmpRecords[0][tmpColumn];
                  generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
                } else {
                  tmpUpdate += ' [' + tmpColumn + '] = ' + SQL_NOW;
                }
                break;
              case 'UpdateIDUser':
                // This is the user ID, which we hope is in the query.
                // This is how to deal with a normal column
                var tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' [' + tmpColumn + '] = @' + tmpColumnParameter;
                // Set the query parameter
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpColumn);
                break;
              case 'JSON':
                var tmpJSONUpdateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' [' + tmpColumn + '] = @' + tmpJSONUpdateParam;
                pParameters.query.parameters[tmpJSONUpdateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                generateMSSQLParameterTypeEntry(pParameters, tmpJSONUpdateParam, {
                  Type: 'String'
                });
                break;
              case 'JSONProxy':
                var tmpProxyUpdateParam = tmpSchemaEntry.StorageColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' [' + tmpSchemaEntry.StorageColumn + '] = @' + tmpProxyUpdateParam;
                pParameters.query.parameters[tmpProxyUpdateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                generateMSSQLParameterTypeEntry(pParameters, tmpProxyUpdateParam, {
                  Type: 'String'
                });
                break;
              default:
                var tmpColumnDefaultParameter = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' [' + tmpColumn + '] = @' + tmpColumnDefaultParameter;

                // Set the query parameter
                pParameters.query.parameters[tmpColumnDefaultParameter] = tmpRecords[0][tmpColumn];
                generateMSSQLParameterTypeEntry(pParameters, tmpColumnDefaultParameter, tmpSchemaEntry);
                break;
            }

            // We use a number to make sure parameters are unique.
            tmpCurrentColumn++;
          }

          // We need to tell the query not to generate improperly if there are no values set.
          if (tmpUpdate === '') {
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
        var generateUpdateDeleteSetters = function generateUpdateDeleteSetters(pParameters) {
          if (pParameters.query.disableDeleteTracking) {
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
          var tmpSchemaEntry = {
            Type: 'Default'
          };
          for (var i = 0; i < tmpSchema.length; i++) {
            // There is a schema entry for it.  Process it accordingly.
            tmpSchemaEntry = tmpSchema[i];
            var tmpUpdateSql = null;
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpUpdateSql = ' [' + tmpSchemaEntry.Column + '] = 1';
                tmpHasDeletedField = true; //this field is required in order for query to be built
                break;
              case 'DeleteDate':
                tmpUpdateSql = ' [' + tmpSchemaEntry.Column + '] = ' + SQL_NOW;
                break;
              case 'UpdateDate':
                // Delete operation is an Update, so we should stamp the update time
                tmpUpdateSql = ' [' + tmpSchemaEntry.Column + '] = ' + SQL_NOW;
                break;
              case 'DeleteIDUser':
                // This is the user ID, which we hope is in the query.
                // This is how to deal with a normal column
                var tmpColumnParameter = tmpSchemaEntry.Column + '_' + tmpCurrentColumn;
                tmpUpdateSql = ' [' + tmpSchemaEntry.Column + '] = @' + tmpColumnParameter;
                // Set the query parameter
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
                break;
              default:
                //DON'T allow update of other fields in this query
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            tmpUpdate += tmpUpdateSql;

            // We use a number to make sure parameters are unique.
            tmpCurrentColumn++;
          }

          // We need to tell the query not to generate improperly if there are no values set.
          if (!tmpHasDeletedField || tmpUpdate === '') {
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
        var generateUpdateUndeleteSetters = function generateUpdateUndeleteSetters(pParameters) {
          // Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCurrentColumn = 0;
          var tmpHasDeletedField = false;
          var tmpUpdate = '';
          // No hash table yet, so, we will just linear search it for now.
          // This uses the schema to decide if we want to treat a column differently on insert
          var tmpSchemaEntry = {
            Type: 'Default'
          };
          for (var i = 0; i < tmpSchema.length; i++) {
            // There is a schema entry for it.  Process it accordingly.
            tmpSchemaEntry = tmpSchema[i];
            var tmpUpdateSql = null;
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpUpdateSql = ' [' + tmpSchemaEntry.Column + '] = 0';
                tmpHasDeletedField = true; //this field is required in order for query to be built
                break;
              case 'UpdateDate':
                // The undelete operation is an Update, so we should stamp the update time
                tmpUpdateSql = ' [' + tmpSchemaEntry.Column + '] = ' + SQL_NOW;
                break;
              case 'UpdateIDUser':
                var tmpColumnParameter = tmpSchemaEntry.Column + '_' + tmpCurrentColumn;
                tmpUpdateSql = ' [' + tmpSchemaEntry.Column + '] = @' + tmpColumnParameter;
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
                break;
              default:
                //DON'T allow update of other fields in this query
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            tmpUpdate += tmpUpdateSql;

            // We use a number to make sure parameters are unique.
            tmpCurrentColumn++;
          }

          // We need to tell the query not to generate improperly if there are no values set.
          if (!tmpHasDeletedField || tmpUpdate === '') {
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
        var generateCreateSetValues = function generateCreateSetValues(pParameters) {
          var tmpRecords = pParameters.query.records;
          // We need to tell the query not to generate improperly if there are no values to set.
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }

          // Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCreateSet = '';
          // If there is more than one record in records, we are going to ignore them for now.
          var tmpCurrentColumn = 0;
          for (var tmpColumn in tmpRecords[0]) {
            // No hash table yet, so, we will just linear search it for now.
            // This uses the schema to decide if we want to treat a column differently on insert
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                // There is a schema entry for it.  Process it accordingly.
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (!pParameters.query.disableDeleteTracking) {
              if (tmpSchemaEntry.Type === 'DeleteDate' || tmpSchemaEntry.Type === 'DeleteIDUser') {
                // These are all ignored on insert (if delete tracking is enabled as normal)
                continue;
              }
            }
            if (tmpCurrentColumn > 0 && tmpCreateSet != '') {
              tmpCreateSet += ',';
            }

            //define a re-usable method for setting up field definitions in a default pattern
            var buildDefaultDefinition = function buildDefaultDefinition() {
              var tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
              tmpCreateSet += ' @' + tmpColumnParameter;
              // Set the query parameter
              pParameters.query.parameters[tmpColumnParameter] = tmpRecords[0][tmpColumn];
              generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
            };
            var tmpColumnParameter;
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
                if (pParameters.query.disableAutoIdentity) {
                  buildDefaultDefinition();
                } else {
                  // This is an autoidentity, so we don't parameterize it and just pass in NULL
                  //tmpCreateSet += ' NULL';
                  // For MSSQL we have to skip this.  NULL and DEFAULT both error for autoidentities.
                }
                break;
              case 'AutoGUID':
                if (pParameters.query.disableAutoIdentity) {
                  buildDefaultDefinition();
                } else if (tmpRecords[0][tmpColumn] && tmpRecords[0][tmpColumn].length >= 5 && tmpRecords[0][tmpColumn] !== '0x0000000000000000')
                  //stricture default
                  {
                    // Allow consumer to override AutoGUID
                    buildDefaultDefinition();
                  } else {
                  // This is an autoidentity, so we don't parameterize it and just pass in NULL
                  tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                  tmpCreateSet += ' @' + tmpColumnParameter;
                  // Set the query parameter
                  pParameters.query.parameters[tmpColumnParameter] = pParameters.query.UUID;
                  generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
                }
                break;
              case 'UpdateDate':
              case 'CreateDate':
              case 'DeleteDate':
                if (pParameters.query.disableAutoDateStamp) {
                  buildDefaultDefinition();
                } else {
                  // This is an autoidentity, so we don't parameterize it and just pass in NULL
                  tmpCreateSet += ' ' + SQL_NOW;
                }
                break;
              case 'DeleteIDUser':
              case 'UpdateIDUser':
              case 'CreateIDUser':
                if (pParameters.query.disableAutoUserStamp) {
                  buildDefaultDefinition();
                } else {
                  // This is the user ID, which we hope is in the query.
                  // This is how to deal with a normal column
                  tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                  tmpCreateSet += ' @' + tmpColumnParameter;
                  // Set the query parameter
                  pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                  generateMSSQLParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
                }
                break;
              case 'JSON':
                var tmpJSONCreateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpCreateSet += ' @' + tmpJSONCreateParam;
                pParameters.query.parameters[tmpJSONCreateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                generateMSSQLParameterTypeEntry(pParameters, tmpJSONCreateParam, {
                  Type: 'String'
                });
                break;
              case 'JSONProxy':
                var tmpProxyCreateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpCreateSet += ' @' + tmpProxyCreateParam;
                pParameters.query.parameters[tmpProxyCreateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                generateMSSQLParameterTypeEntry(pParameters, tmpProxyCreateParam, {
                  Type: 'String'
                });
                break;
              default:
                buildDefaultDefinition();
                break;
            }

            // We use an appended number to make sure parameters are unique.
            tmpCurrentColumn++;
          }

          // We need to tell the query not to generate improperly if there are no values set.
          if (tmpCreateSet === '') {
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
        var generateCreateSetList = function generateCreateSetList(pParameters) {
          // The records were already validated by generateCreateSetValues
          var tmpRecords = pParameters.query.records;

          // Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCreateSet = '';
          // If there is more than one record in records, we are going to ignore them for now.
          for (var tmpColumn in tmpRecords[0]) {
            // No hash table yet, so, we will just linear search it for now.
            // This uses the schema to decide if we want to treat a column differently on insert
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                // There is a schema entry for it.  Process it accordingly.
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (!pParameters.query.disableDeleteTracking) {
              if (tmpSchemaEntry.Type === 'DeleteDate' || tmpSchemaEntry.Type === 'DeleteIDUser') {
                // These are all ignored on insert (if delete tracking is enabled as normal)
                continue;
              }
            }
            switch (tmpSchemaEntry.Type) {
              // We skip these for MSSQL on INSERT or they cause an error for some versions (different errors for different versions)
              case 'AutoIdentity':
                if (pParameters.query.disableAutoIdentity) {
                  if (tmpCreateSet != '') {
                    tmpCreateSet += ',';
                  }
                  tmpCreateSet += ' [' + tmpColumn + ']';
                }
                continue;
              case 'JSON':
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' [' + tmpColumn + ']';
                break;
              case 'JSONProxy':
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' [' + tmpSchemaEntry.StorageColumn + ']';
                break;
              default:
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' [' + tmpColumn + ']';
                break;
            }
          }
          return tmpCreateSet;
        };
        var Create = function Create(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpCreateSetList = generateCreateSetList(pParameters);
          var tmpCreateSetValues = generateCreateSetValues(pParameters);
          if (!tmpCreateSetValues) {
            return false;
          }
          return 'INSERT INTO' + tmpTableName + ' (' + tmpCreateSetList + ') VALUES (' + tmpCreateSetValues + ');';
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
        var Read = function Read(pParameters) {
          var tmpFieldList = generateFieldList(pParameters);
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpJoin = generateJoins(pParameters);
          var tmpOrderBy = generateOrderBy(pParameters);
          var tmpLimit = generateLimit(pParameters);
          var tmpIndexHints = generateIndexHints(pParameters);
          const tmpOptDistinct = pParameters.distinct ? ' DISTINCT' : '';
          if (pParameters.queryOverride) {
            try {
              var tmpQueryTemplate = _Fable.Utility.template(pParameters.queryOverride);
              return tmpQueryTemplate({
                FieldList: tmpFieldList,
                TableName: tmpTableName,
                Where: tmpWhere,
                Join: tmpJoin,
                OrderBy: tmpOrderBy,
                Limit: tmpLimit,
                IndexHints: tmpIndexHints,
                Distinct: tmpOptDistinct,
                _Params: pParameters
              });
            } catch (pError) {
              // This pokemon is here to give us a convenient way of not throwing up totally if the query fails.
              console.log('Error with custom Read Query [' + pParameters.queryOverride + ']: ' + pError);
              return false;
            }
          }

          // Legacy pagination path — emit a ROW_NUMBER() wrapper instead of
          // OFFSET/FETCH.  Required for SQL Server 2008 R2 and earlier, or
          // for databases running at a compatibility level below 110 (2012).
          // Enabled via pParameters.legacyPagination (forwarded from the
          // meadow-connection-mssql provider's LegacyPagination config).
          if (pParameters.legacyPagination && pParameters.cap) {
            var tmpBegin = pParameters.begin !== false ? pParameters.begin : 0;
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
            return "SELECT".concat(tmpOptDistinct).concat(tmpOuterFieldList, " FROM (SELECT").concat(tmpFieldList, ", ROW_NUMBER() OVER (").concat(tmpOverClause, ") AS [_RowNum] FROM").concat(tmpTableName).concat(tmpIndexHints).concat(tmpJoin).concat(tmpWhere, ") AS [_Paged] WHERE [_RowNum] > ").concat(tmpBegin, " AND [_RowNum] <= ").concat(tmpEnd, ";");
          }
          return "SELECT".concat(tmpOptDistinct).concat(tmpFieldList, " FROM").concat(tmpTableName).concat(tmpIndexHints).concat(tmpJoin).concat(tmpWhere).concat(tmpOrderBy).concat(tmpLimit, ";");
        };
        var Update = function Update(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpUpdateSetters = generateUpdateSetters(pParameters);
          if (!tmpUpdateSetters) {
            return false;
          }
          return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateSetters + tmpWhere + ';';
        };
        var Delete = function Delete(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpUpdateDeleteSetters = generateUpdateDeleteSetters(pParameters);
          if (tmpUpdateDeleteSetters) {
            //If it has a deleted bit, update it instead of actually deleting the record
            return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateDeleteSetters + tmpWhere + ';';
          } else {
            return 'DELETE FROM' + tmpTableName + tmpWhere + ';';
          }
        };
        var Undelete = function Undelete(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          // TODO: Fix these
          let tmpDeleteTrackingState = pParameters.query.disableDeleteTracking;
          pParameters.query.disableDeleteTracking = true;
          var tmpWhere = generateWhere(pParameters);
          var tmpUpdateUndeleteSetters = generateUpdateUndeleteSetters(pParameters);
          pParameters.query.disableDeleteTracking = tmpDeleteTrackingState;
          if (tmpUpdateUndeleteSetters) {
            //If the table has a deleted bit, go forward with the update to change things.
            return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateUndeleteSetters + tmpWhere + ';';
          } else {
            // This is a no-op because the record can't be undeleted.
            // TODO: Should it throw instead?
            return 'SELECT NULL;';
          }
        };
        var Count = function Count(pParameters) {
          var tmpFieldList = pParameters.distinct ? generateFieldList(pParameters, true) : '*';
          var tmpTableName = generateTableName(pParameters);
          var tmpJoin = generateJoins(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpIndexHints = generateIndexHints(pParameters);
          // here, we ignore the distinct keyword if no fields have been specified and
          if (pParameters.distinct && tmpFieldList.length < 1) {
            console.warn('Distinct requested but no field list or schema are available, so not honoring distinct for count query.');
          }
          const tmpOptDistinct = pParameters.distinct && tmpFieldList.length > 0 ? 'DISTINCT' : '';
          if (pParameters.queryOverride) {
            try {
              var tmpQueryTemplate = _Fable.Utility.template(pParameters.queryOverride);
              return tmpQueryTemplate({
                FieldList: [],
                TableName: tmpTableName,
                Where: tmpWhere,
                OrderBy: '',
                IndexHints: tmpIndexHints,
                Limit: '',
                Distinct: tmpOptDistinct,
                _Params: pParameters
              });
            } catch (pError) {
              // This pokemon is here to give us a convenient way of not throwing up totally if the query fails.
              console.log('Error with custom Count Query [' + pParameters.queryOverride + ']: ' + pError);
              return false;
            }
          }
          return "SELECT COUNT(".concat(tmpOptDistinct).concat(tmpFieldList || '*', ") AS Row_Count FROM").concat(tmpTableName).concat(tmpIndexHints).concat(tmpJoin).concat(tmpWhere, ";");
        };
        var tmpDialect = {
          Create: Create,
          Read: Read,
          Update: Update,
          Delete: Delete,
          Undelete: Undelete,
          Count: Count
        };

        /**
        * Dialect Name
        *
        * @property name
        * @type string
        */
        Object.defineProperty(tmpDialect, 'name', {
          get: function get() {
            return 'MSSQL';
          },
          enumerable: true
        });
        return tmpDialect;
      };
      module.exports = FoxHoundDialectMSSQL;
    }, {}],
    9: [function (require, module, exports) {
      /**
      * FoxHound MongoDB Dialect
      *
      * Generates JSON operation descriptors for MongoDB queries.
      * The query body is a JSON string; the parsed operation object is also
      * stored in query.parameters.mongoOperation for direct provider consumption.
      *
      * @license MIT
      *
      * @author Steven Velozo <steven@velozo.com>
      * @class FoxHoundDialectMongoDB
      */

      var FoxHoundDialectMongoDB = function FoxHoundDialectMongoDB(pFable) {
        let _Fable = pFable;

        /**
        * Strip any table-name prefix from a column name.
        * MongoDB has no table-qualified field names.
        *
        * @method stripTablePrefix
        * @param {String} pColumn Column name, possibly table-qualified
        * @return {String} Plain column name
        */
        var stripTablePrefix = function stripTablePrefix(pColumn) {
          if (typeof pColumn !== 'string') {
            return pColumn;
          }
          // Remove backtick and double-quote quoting
          var tmpColumn = pColumn.replace(/[`"]/g, '');
          // Strip table prefix (e.g. "Animal.Name" -> "Name")
          if (tmpColumn.indexOf('.') >= 0) {
            var tmpParts = tmpColumn.split('.');
            // If it ends with *, just ignore it (wildcard in MongoDB = all fields)
            if (tmpParts[tmpParts.length - 1] === '*') {
              return '*';
            }
            return tmpParts[tmpParts.length - 1];
          }
          return tmpColumn;
        };

        /**
        * Find the schema entry for a given column name.
        *
        * @method findSchemaEntry
        * @param {String} pColumn Column name
        * @param {Array} pSchema Schema array
        * @return {Object} Schema entry or default
        */
        var findSchemaEntry = function findSchemaEntry(pColumn, pSchema) {
          for (var i = 0; i < pSchema.length; i++) {
            if (pColumn == pSchema[i].Column) {
              return pSchema[i];
            }
          }
          return {
            Column: pColumn,
            Type: 'Default'
          };
        };

        /**
        * Translate a single FoxHound filter operator into a MongoDB condition object.
        *
        * @method translateOperator
        * @param {Object} pFilterEntry A FoxHound filter object
        * @return {Object} MongoDB condition object
        */
        var translateOperator = function translateOperator(pFilterEntry) {
          var tmpColumn = stripTablePrefix(pFilterEntry.Column);
          var tmpValue = pFilterEntry.Value;
          switch (pFilterEntry.Operator) {
            case '=':
              var tmpObj = {};
              tmpObj[tmpColumn] = tmpValue;
              return tmpObj;
            case '!=':
              var tmpNeObj = {};
              tmpNeObj[tmpColumn] = {
                $ne: tmpValue
              };
              return tmpNeObj;
            case '>':
              var tmpGtObj = {};
              tmpGtObj[tmpColumn] = {
                $gt: tmpValue
              };
              return tmpGtObj;
            case '>=':
              var tmpGteObj = {};
              tmpGteObj[tmpColumn] = {
                $gte: tmpValue
              };
              return tmpGteObj;
            case '<':
              var tmpLtObj = {};
              tmpLtObj[tmpColumn] = {
                $lt: tmpValue
              };
              return tmpLtObj;
            case '<=':
              var tmpLteObj = {};
              tmpLteObj[tmpColumn] = {
                $lte: tmpValue
              };
              return tmpLteObj;
            case 'LIKE':
              // Convert SQL LIKE pattern to regex: % -> .*, _ -> .
              var tmpPattern = String(tmpValue).replace(/%/g, '.*').replace(/_/g, '.');
              var tmpLikeObj = {};
              tmpLikeObj[tmpColumn] = {
                $regex: tmpPattern,
                $options: 'i'
              };
              return tmpLikeObj;
            case 'IN':
              var tmpInObj = {};
              tmpInObj[tmpColumn] = {
                $in: Array.isArray(tmpValue) ? tmpValue : [tmpValue]
              };
              return tmpInObj;
            case 'NOT IN':
              var tmpNinObj = {};
              tmpNinObj[tmpColumn] = {
                $nin: Array.isArray(tmpValue) ? tmpValue : [tmpValue]
              };
              return tmpNinObj;
            case 'IS NULL':
              var tmpNullObj = {};
              tmpNullObj[tmpColumn] = null;
              return tmpNullObj;
            case 'IS NOT NULL':
              var tmpNotNullObj = {};
              tmpNotNullObj[tmpColumn] = {
                $ne: null
              };
              return tmpNotNullObj;
            default:
              // Unknown operator, treat as equality
              var tmpDefaultObj = {};
              tmpDefaultObj[tmpColumn] = tmpValue;
              return tmpDefaultObj;
          }
        };

        /**
        * Safely merge an array of condition objects into a single MongoDB filter.
        * If there are key collisions, wrap in $and.
        *
        * @method mergeConditions
        * @param {Array} pConditions Array of condition objects
        * @return {Object} Merged MongoDB filter
        */
        var mergeConditions = function mergeConditions(pConditions) {
          if (!pConditions || pConditions.length === 0) {
            return {};
          }
          if (pConditions.length === 1) {
            var tmpSingle = pConditions[0];
            delete tmpSingle._connector;
            return tmpSingle;
          }

          // Check for key collisions
          var tmpKeysSeen = {};
          var tmpHasCollision = false;
          for (var i = 0; i < pConditions.length; i++) {
            var tmpKeys = Object.keys(pConditions[i]);
            for (var j = 0; j < tmpKeys.length; j++) {
              var tmpKey = tmpKeys[j];
              if (tmpKey === '_connector') continue;
              if (tmpKey.charAt(0) === '$') {
                tmpHasCollision = true;
                break;
              }
              if (tmpKeysSeen[tmpKey]) {
                tmpHasCollision = true;
                break;
              }
              tmpKeysSeen[tmpKey] = true;
            }
            if (tmpHasCollision) break;
          }
          if (tmpHasCollision) {
            // Must use $and
            var tmpAndArray = [];
            for (var k = 0; k < pConditions.length; k++) {
              var tmpCond = pConditions[k];
              delete tmpCond._connector;
              tmpAndArray.push(tmpCond);
            }
            return {
              $and: tmpAndArray
            };
          } else {
            // Safe to merge into a single object
            var tmpMerged = {};
            for (var m = 0; m < pConditions.length; m++) {
              var tmpCondM = pConditions[m];
              var tmpKeysM = Object.keys(tmpCondM);
              for (var n = 0; n < tmpKeysM.length; n++) {
                if (tmpKeysM[n] !== '_connector') {
                  tmpMerged[tmpKeysM[n]] = tmpCondM[tmpKeysM[n]];
                }
              }
            }
            return tmpMerged;
          }
        };

        /**
        * Generate the MongoDB filter object from the FoxHound filter array.
        * Uses a stack-based approach for parenthetical groups.
        *
        * @method generateFilter
        * @param {Object} pParameters SQL Query Parameters
        * @return {Object} MongoDB filter object
        */
        var generateFilter = function generateFilter(pParameters) {
          var tmpFilter = Array.isArray(pParameters.filter) ? pParameters.filter.slice() : [];

          // Auto-add Deleted filter if applicable
          if (!pParameters.query.disableDeleteTracking) {
            var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpSchema[i].Type === 'Deleted') {
                var tmpHasDeletedParam = false;
                for (var x = 0; x < tmpFilter.length; x++) {
                  if (stripTablePrefix(tmpFilter[x].Column) === tmpSchema[i].Column) {
                    tmpHasDeletedParam = true;
                    break;
                  }
                }
                if (!tmpHasDeletedParam) {
                  tmpFilter.push({
                    Column: tmpSchema[i].Column,
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
          if (tmpFilter.length < 1) {
            return {};
          }

          // Stack-based processing for parenthetical groups
          var tmpStack = [[]]; // Stack of condition arrays

          for (var i = 0; i < tmpFilter.length; i++) {
            var tmpEntry = tmpFilter[i];
            if (tmpEntry.Operator === '(') {
              tmpStack.push([]);
            } else if (tmpEntry.Operator === ')') {
              var tmpGroupConditions = tmpStack.pop();

              // Check if any condition inside the group used OR
              var tmpHasOR = false;
              for (var g = 0; g < tmpGroupConditions.length; g++) {
                if (tmpGroupConditions[g]._connector === 'OR') {
                  tmpHasOR = true;
                  break;
                }
              }
              var tmpWrapped;
              if (tmpHasOR) {
                var tmpOrArray = [];
                for (var g2 = 0; g2 < tmpGroupConditions.length; g2++) {
                  delete tmpGroupConditions[g2]._connector;
                  tmpOrArray.push(tmpGroupConditions[g2]);
                }
                tmpWrapped = {
                  $or: tmpOrArray
                };
              } else {
                tmpWrapped = mergeConditions(tmpGroupConditions);
              }
              tmpWrapped._connector = tmpEntry.Connector || 'AND';
              tmpStack[tmpStack.length - 1].push(tmpWrapped);
            } else {
              var tmpCondition = translateOperator(tmpEntry);
              tmpCondition._connector = tmpEntry.Connector || 'AND';
              tmpStack[tmpStack.length - 1].push(tmpCondition);
            }
          }

          // Collapse root level
          var tmpRootConditions = tmpStack[0];
          return mergeConditions(tmpRootConditions);
        };

        /**
        * Generate the MongoDB projection object from dataElements.
        *
        * @method generateProjection
        * @param {Object} pParameters SQL Query Parameters
        * @return {Object} MongoDB projection object (empty = all fields)
        */
        var generateProjection = function generateProjection(pParameters) {
          var tmpDataElements = pParameters.dataElements;
          if (!Array.isArray(tmpDataElements) || tmpDataElements.length < 1) {
            return {};
          }
          var tmpProjection = {};
          for (var i = 0; i < tmpDataElements.length; i++) {
            var tmpField = tmpDataElements[i];
            // Handle array format [FieldName, Alias]
            if (Array.isArray(tmpField)) {
              tmpField = tmpField[0];
            }
            tmpField = stripTablePrefix(tmpField);
            if (tmpField !== '*') {
              tmpProjection[tmpField] = 1;
            }
          }
          return tmpProjection;
        };

        /**
        * Generate the MongoDB sort object from sort array.
        *
        * @method generateSort
        * @param {Object} pParameters SQL Query Parameters
        * @return {Object} MongoDB sort object (empty = no sort)
        */
        var generateSort = function generateSort(pParameters) {
          var tmpSort = pParameters.sort;
          if (!Array.isArray(tmpSort) || tmpSort.length < 1) {
            return {};
          }
          var tmpSortObj = {};
          for (var i = 0; i < tmpSort.length; i++) {
            var tmpColumn = stripTablePrefix(tmpSort[i].Column);
            tmpSortObj[tmpColumn] = tmpSort[i].Direction === 'Descending' ? -1 : 1;
          }
          return tmpSortObj;
        };

        /**
        * Generate the document for a create (insertOne) operation.
        * Walks the record through the schema to handle special column types.
        *
        * @method generateCreateDocument
        * @param {Object} pParameters SQL Query Parameters
        * @return {Object|false} Document object or false if no record
        */
        var generateCreateDocument = function generateCreateDocument(pParameters) {
          var tmpRecords = pParameters.query.records;
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpDocument = {};
          for (var tmpColumn in tmpRecords[0]) {
            var tmpSchemaEntry = findSchemaEntry(tmpColumn, tmpSchema);
            if (!pParameters.query.disableDeleteTracking) {
              if (tmpSchemaEntry.Type === 'DeleteDate' || tmpSchemaEntry.Type === 'DeleteIDUser') {
                continue;
              }
            }
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
                if (pParameters.query.disableAutoIdentity) {
                  tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                } else {
                  tmpDocument[tmpColumn] = '$$AUTOINCREMENT';
                }
                break;
              case 'AutoGUID':
                if (pParameters.query.disableAutoIdentity) {
                  tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                } else if (tmpRecords[0][tmpColumn] && tmpRecords[0][tmpColumn].length >= 5 && tmpRecords[0][tmpColumn] !== '0x0000000000000000') {
                  tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                } else {
                  tmpDocument[tmpColumn] = pParameters.query.UUID;
                }
                break;
              case 'UpdateDate':
              case 'CreateDate':
                if (pParameters.query.disableAutoDateStamp) {
                  tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                } else {
                  tmpDocument[tmpColumn] = '$$NOW';
                }
                break;
              case 'DeleteIDUser':
              case 'UpdateIDUser':
              case 'CreateIDUser':
                if (pParameters.query.disableAutoUserStamp) {
                  tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                } else {
                  tmpDocument[tmpColumn] = pParameters.query.IDUser;
                }
                break;
              case 'Deleted':
                tmpDocument[tmpColumn] = 0;
                break;
              default:
                tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                break;
            }
          }
          if (Object.keys(tmpDocument).length === 0) {
            return false;
          }
          return tmpDocument;
        };

        /**
        * Generate the $set document for an update operation.
        * Walks the record through the schema, skipping identity/create/delete columns.
        *
        * @method generateUpdateDocument
        * @param {Object} pParameters SQL Query Parameters
        * @return {Object|false} Update document or false if no record
        */
        var generateUpdateDocument = function generateUpdateDocument(pParameters) {
          var tmpRecords = pParameters.query.records;
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpUpdateDoc = {};
          for (var tmpColumn in tmpRecords[0]) {
            var tmpSchemaEntry = findSchemaEntry(tmpColumn, tmpSchema);
            if (pParameters.query.disableAutoUserStamp && tmpSchemaEntry.Type === 'UpdateIDUser') {
              continue;
            }
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
              case 'CreateDate':
              case 'CreateIDUser':
              case 'DeleteDate':
              case 'DeleteIDUser':
                continue;
            }
            switch (tmpSchemaEntry.Type) {
              case 'UpdateDate':
                if (pParameters.query.disableAutoDateStamp) {
                  tmpUpdateDoc[tmpColumn] = tmpRecords[0][tmpColumn];
                } else {
                  tmpUpdateDoc[tmpColumn] = '$$NOW';
                }
                break;
              case 'UpdateIDUser':
                tmpUpdateDoc[tmpColumn] = pParameters.query.IDUser;
                break;
              default:
                tmpUpdateDoc[tmpColumn] = tmpRecords[0][tmpColumn];
                break;
            }
          }
          if (Object.keys(tmpUpdateDoc).length === 0) {
            return false;
          }
          return tmpUpdateDoc;
        };

        /**
        * Generate the soft-delete $set document.
        * Returns false if no Deleted column exists or delete tracking is disabled.
        *
        * @method generateDeleteSetters
        * @param {Object} pParameters SQL Query Parameters
        * @return {Object|false} Delete setters or false
        */
        var generateDeleteSetters = function generateDeleteSetters(pParameters) {
          if (pParameters.query.disableDeleteTracking) {
            return false;
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpHasDeletedField = false;
          var tmpSetters = {};
          for (var i = 0; i < tmpSchema.length; i++) {
            var tmpSchemaEntry = tmpSchema[i];
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpSetters[tmpSchemaEntry.Column] = 1;
                tmpHasDeletedField = true;
                break;
              case 'DeleteDate':
                tmpSetters[tmpSchemaEntry.Column] = '$$NOW';
                break;
              case 'UpdateDate':
                tmpSetters[tmpSchemaEntry.Column] = '$$NOW';
                break;
              case 'DeleteIDUser':
                tmpSetters[tmpSchemaEntry.Column] = pParameters.query.IDUser;
                break;
              default:
                continue;
            }
          }
          if (!tmpHasDeletedField || Object.keys(tmpSetters).length === 0) {
            return false;
          }
          return tmpSetters;
        };

        /**
        * Generate the undelete $set document.
        * Returns false if no Deleted column exists.
        *
        * @method generateUndeleteSetters
        * @param {Object} pParameters SQL Query Parameters
        * @return {Object|false} Undelete setters or false
        */
        var generateUndeleteSetters = function generateUndeleteSetters(pParameters) {
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpHasDeletedField = false;
          var tmpSetters = {};
          for (var i = 0; i < tmpSchema.length; i++) {
            var tmpSchemaEntry = tmpSchema[i];
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpSetters[tmpSchemaEntry.Column] = 0;
                tmpHasDeletedField = true;
                break;
              case 'UpdateDate':
                tmpSetters[tmpSchemaEntry.Column] = '$$NOW';
                break;
              case 'UpdateIDUser':
                tmpSetters[tmpSchemaEntry.Column] = pParameters.query.IDUser;
                break;
              default:
                continue;
            }
          }
          if (!tmpHasDeletedField || Object.keys(tmpSetters).length === 0) {
            return false;
          }
          return tmpSetters;
        };

        /**
        * Create a new record
        *
        * @method Create
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor or false
        */
        var Create = function Create(pParameters) {
          var tmpDocument = generateCreateDocument(pParameters);
          if (!tmpDocument) {
            return false;
          }
          var tmpResult = {
            collection: pParameters.scope,
            operation: 'insertOne',
            document: tmpDocument
          };
          pParameters.query.parameters.mongoOperation = tmpResult;
          return JSON.stringify(tmpResult);
        };

        /**
        * Read one or many records
        *
        * @method Read
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor
        */
        var Read = function Read(pParameters) {
          if (pParameters.join && Array.isArray(pParameters.join) && pParameters.join.length > 0) {
            _Fable.log.warn('MongoDB dialect does not support JOINs; join parameter will be ignored.');
          }
          var tmpFilter = generateFilter(pParameters);
          var tmpProjection = generateProjection(pParameters);
          var tmpSort = generateSort(pParameters);
          var tmpResult = {
            collection: pParameters.scope,
            operation: 'find',
            filter: tmpFilter
          };
          if (Object.keys(tmpProjection).length > 0) {
            tmpResult.projection = tmpProjection;
          }
          if (Object.keys(tmpSort).length > 0) {
            tmpResult.sort = tmpSort;
          }
          if (pParameters.cap) {
            tmpResult.limit = pParameters.cap;
          }
          if (pParameters.begin !== false && pParameters.begin > 0) {
            tmpResult.skip = pParameters.begin;
          }
          if (pParameters.distinct) {
            tmpResult.distinct = true;
          }
          pParameters.query.parameters.mongoOperation = tmpResult;
          return JSON.stringify(tmpResult);
        };

        /**
        * Update one or many records
        *
        * @method Update
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor or false
        */
        var Update = function Update(pParameters) {
          var tmpFilter = generateFilter(pParameters);
          var tmpUpdateDoc = generateUpdateDocument(pParameters);
          if (!tmpUpdateDoc) {
            return false;
          }
          var tmpResult = {
            collection: pParameters.scope,
            operation: 'updateMany',
            filter: tmpFilter,
            update: {
              $set: tmpUpdateDoc
            }
          };
          pParameters.query.parameters.mongoOperation = tmpResult;
          return JSON.stringify(tmpResult);
        };

        /**
        * Delete one or many records (soft or hard depending on schema)
        *
        * @method Delete
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor
        */
        var Delete = function Delete(pParameters) {
          var tmpDeleteSetters = generateDeleteSetters(pParameters);
          var tmpFilter = generateFilter(pParameters);
          if (tmpDeleteSetters) {
            // Soft delete via update
            var tmpResult = {
              collection: pParameters.scope,
              operation: 'updateMany',
              filter: tmpFilter,
              update: {
                $set: tmpDeleteSetters
              }
            };
            pParameters.query.parameters.mongoOperation = tmpResult;
            return JSON.stringify(tmpResult);
          } else {
            // Hard delete
            var tmpHardResult = {
              collection: pParameters.scope,
              operation: 'deleteMany',
              filter: tmpFilter
            };
            pParameters.query.parameters.mongoOperation = tmpHardResult;
            return JSON.stringify(tmpHardResult);
          }
        };

        /**
        * Undelete (restore) a soft-deleted record
        *
        * @method Undelete
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor
        */
        var Undelete = function Undelete(pParameters) {
          var tmpUndeleteSetters = generateUndeleteSetters(pParameters);

          // Temporarily disable delete tracking for filter generation
          // so we can find records where Deleted=1
          var tmpDeleteTrackingState = pParameters.query.disableDeleteTracking;
          pParameters.query.disableDeleteTracking = true;
          var tmpFilter = generateFilter(pParameters);
          pParameters.query.disableDeleteTracking = tmpDeleteTrackingState;
          if (tmpUndeleteSetters) {
            var tmpResult = {
              collection: pParameters.scope,
              operation: 'updateMany',
              filter: tmpFilter,
              update: {
                $set: tmpUndeleteSetters
              }
            };
            pParameters.query.parameters.mongoOperation = tmpResult;
            return JSON.stringify(tmpResult);
          } else {
            // No-op -- can't undelete without a Deleted column
            var tmpNoopResult = {
              collection: pParameters.scope,
              operation: 'noop'
            };
            pParameters.query.parameters.mongoOperation = tmpNoopResult;
            return JSON.stringify(tmpNoopResult);
          }
        };

        /**
        * Count records
        *
        * @method Count
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor
        */
        var Count = function Count(pParameters) {
          var tmpFilter = generateFilter(pParameters);
          var tmpResult = {
            collection: pParameters.scope,
            operation: 'countDocuments',
            filter: tmpFilter
          };
          if (pParameters.distinct) {
            tmpResult.distinct = true;
            var tmpDataElements = pParameters.dataElements;
            if (Array.isArray(tmpDataElements) && tmpDataElements.length > 0) {
              var tmpFields = [];
              for (var i = 0; i < tmpDataElements.length; i++) {
                var tmpField = Array.isArray(tmpDataElements[i]) ? tmpDataElements[i][0] : tmpDataElements[i];
                tmpField = stripTablePrefix(tmpField);
                if (tmpField !== '*') {
                  tmpFields.push(tmpField);
                }
              }
              if (tmpFields.length > 0) {
                tmpResult.distinctFields = tmpFields;
              }
            } else {
              // Fall back to AutoIdentity column from schema
              var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
              for (var j = 0; j < tmpSchema.length; j++) {
                if (tmpSchema[j].Type === 'AutoIdentity') {
                  tmpResult.distinctFields = [tmpSchema[j].Column];
                  break;
                }
              }
            }
          }
          pParameters.query.parameters.mongoOperation = tmpResult;
          return JSON.stringify(tmpResult);
        };
        var tmpDialect = {
          Create: Create,
          Read: Read,
          Update: Update,
          Delete: Delete,
          Undelete: Undelete,
          Count: Count
        };

        /**
        * Dialect Name
        *
        * @property name
        * @type string
        */
        Object.defineProperty(tmpDialect, 'name', {
          get: function get() {
            return 'MongoDB';
          },
          enumerable: true
        });
        return tmpDialect;
      };
      module.exports = FoxHoundDialectMongoDB;
    }, {}],
    10: [function (require, module, exports) {
      /**
      * FoxHound MySQL Dialect
      *
      * @license MIT
      *
      * For a MySQL query override:
      // An underscore template with the following values:
      //      <%= DataElements %> = Field1, Field2, Field3, Field4
      //      <%= Begin %>        = 0
      //      <%= Cap %>          = 10
      //      <%= Filter %>       = WHERE StartDate > :MyStartDate
      //      <%= Sort %>         = ORDER BY Field1
      // The values are empty strings if they aren't set.
      *
      * @author Steven Velozo <steven@velozo.com>
      * @class FoxHoundDialectMySQL
      */

      var FoxHoundDialectMySQL = function FoxHoundDialectMySQL(pFable) {
        //Request time from SQL server with microseconds resolution
        const SQL_NOW = "NOW(3)";
        let _Fable = pFable;

        /**
        * Generate a table name from the scope
        *
        * @method: generateTableName
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table name clause
        */
        var generateTableName = function generateTableName(pParameters) {
          if (pParameters.scope && pParameters.scope.indexOf('`') >= 0) return ' ' + pParameters.scope + '';else return ' `' + pParameters.scope + '`';
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
        var generateFieldList = function generateFieldList(pParameters, pIsForCountClause) {
          var tmpDataElements = pParameters.dataElements;
          if (!Array.isArray(tmpDataElements) || tmpDataElements.length < 1) {
            const tmpTableName = generateTableName(pParameters);
            if (!pIsForCountClause) {
              return tmpTableName + '.*';
            }
            // we need to list all of the table fields explicitly; get them from the schema
            const tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            if (tmpSchema.length < 1) {
              // this means we have no schema; returning an empty string here signals the calling code to handle this case
              return '';
            }
            const idColumn = tmpSchema.find(entry => entry.Type === 'AutoIdentity');
            if (!idColumn) {
              // this means there is no autoincrementing unique ID column; treat as above
              return '';
            }
            const qualifiedIDColumn = "".concat(tmpTableName, ".").concat(idColumn.Column);
            return " ".concat(generateSafeFieldName(qualifiedIDColumn));
          }
          var tmpFieldList = ' ';
          for (var i = 0; i < tmpDataElements.length; i++) {
            if (i > 0) {
              tmpFieldList += ', ';
            }
            if (Array.isArray(tmpDataElements[i])) {
              tmpFieldList += generateSafeFieldName(tmpDataElements[i][0]);
              if (tmpDataElements[i].length > 1 && tmpDataElements[i][1]) {
                tmpFieldList += " AS " + generateSafeFieldName(tmpDataElements[i][1]);
              }
            } else {
              tmpFieldList += generateSafeFieldName(tmpDataElements[i]);
            }
          }
          return tmpFieldList;
        };
        const SURROUNDING_QUOTES_AND_WHITESPACE_REGEX = /^[` ]+|[` ]+$/g;
        const cleanseQuoting = str => {
          return str.replace(SURROUNDING_QUOTES_AND_WHITESPACE_REGEX, '');
        };

        /**
        * Ensure a field name is properly escaped.
        */
        var generateSafeFieldName = function generateSafeFieldName(pFieldName) {
          let pFieldNames = pFieldName.split('.');
          if (pFieldNames.length > 1) {
            const cleansedFieldName = cleanseQuoting(pFieldNames[1]);
            if (cleansedFieldName === '*') {
              // do not put * as `*`
              return "`" + cleanseQuoting(pFieldNames[0]) + "`.*";
            }
            return "`" + cleanseQuoting(pFieldNames[0]) + "`.`" + cleansedFieldName + "`";
          }
          const cleansedFieldName = cleanseQuoting(pFieldNames[0]);
          if (cleansedFieldName === '*') {
            // do not put * as `*`
            return '*';
          }
          return "`" + cleanseQuoting(pFieldNames[0]) + "`";
        };
        var resolveJsonColumnPath = function resolveJsonColumnPath(pColumnName, pSchema) {
          if (!Array.isArray(pSchema) || pSchema.length < 1) return null;

          // Check for dot notation indicating JSON path: e.g. "Metadata.key" or "FableTest.Metadata.key"
          var tmpParts = pColumnName.replace(/`/g, '').split('.');
          for (var tmpStartIdx = 0; tmpStartIdx < Math.min(tmpParts.length - 1, 2); tmpStartIdx++) {
            var tmpBaseColumn = tmpParts[tmpStartIdx];
            for (var s = 0; s < pSchema.length; s++) {
              if (pSchema[s].Column === tmpBaseColumn && (pSchema[s].Type === 'JSON' || pSchema[s].Type === 'JSONProxy')) {
                var tmpActualColumn = pSchema[s].Type === 'JSONProxy' ? pSchema[s].StorageColumn : tmpBaseColumn;
                var tmpJsonPath = '$.' + tmpParts.slice(tmpStartIdx + 1).join('.');
                return {
                  column: tmpActualColumn,
                  path: tmpJsonPath
                };
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
        var generateWhere = function generateWhere(pParameters) {
          var tmpFilter = Array.isArray(pParameters.filter) ? pParameters.filter : [];
          var tmpTableName = generateTableName(pParameters);
          if (!pParameters.query.disableDeleteTracking) {
            // Check if there is a Deleted column on the Schema. If so, we add this to the filters automatically (if not already present)
            var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            for (var i = 0; i < tmpSchema.length; i++) {
              // There is a schema entry for it.  Process it accordingly.
              var tmpSchemaEntry = tmpSchema[i];
              if (tmpSchemaEntry.Type === 'Deleted') {
                var tmpHasDeletedParameter = false;

                //first, check to see if filters are already looking for Deleted column
                if (tmpFilter.length > 0) {
                  for (var x = 0; x < tmpFilter.length; x++) {
                    if (tmpFilter[x].Column === tmpSchemaEntry.Column) {
                      tmpHasDeletedParameter = true;
                      break;
                    }
                  }
                }
                if (!tmpHasDeletedParameter) {
                  //if not, we need to add it
                  tmpFilter.push({
                    Column: tmpTableName + '.' + tmpSchemaEntry.Column,
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
          if (tmpFilter.length < 1) {
            return '';
          }
          var tmpWhere = ' WHERE';

          // This is used to disable the connectors for subsequent queries.
          // Only the open parenthesis operator uses this, currently.
          var tmpLastOperatorNoConnector = false;
          for (var i = 0; i < tmpFilter.length; i++) {
            if (tmpFilter[i].Connector != 'NONE' && tmpFilter[i].Operator != ')' && tmpWhere != ' WHERE' && tmpLastOperatorNoConnector == false) {
              tmpWhere += ' ' + tmpFilter[i].Connector;
            }
            tmpLastOperatorNoConnector = false;
            var tmpColumnParameter;
            if (tmpFilter[i].Operator === '(') {
              // Open a logical grouping
              tmpWhere += ' (';
              tmpLastOperatorNoConnector = true;
            } else if (tmpFilter[i].Operator === ')') {
              // Close a logical grouping
              tmpWhere += ' )';
            } else if (tmpFilter[i].Operator === 'IN' || tmpFilter[i].Operator === "NOT IN") {
              tmpColumnParameter = tmpFilter[i].Parameter + '_w' + i;
              // Add the column name, operator and parameter name to the list of where value parenthetical
              tmpWhere += ' ' + tmpFilter[i].Column + ' ' + tmpFilter[i].Operator + ' ( :' + tmpColumnParameter + ' )';
              pParameters.query.parameters[tmpColumnParameter] = tmpFilter[i].Value;
            } else if (tmpFilter[i].Operator === 'IS NULL') {
              // IS NULL is a special operator which doesn't require a value, or parameter
              tmpWhere += ' ' + tmpFilter[i].Column + ' ' + tmpFilter[i].Operator;
            } else if (tmpFilter[i].Operator === 'IS NOT NULL') {
              // IS NOT NULL is a special operator which doesn't require a value, or parameter
              tmpWhere += ' ' + tmpFilter[i].Column + ' ' + tmpFilter[i].Operator;
            } else {
              tmpColumnParameter = tmpFilter[i].Parameter + '_w' + i;
              // Check for JSON path references (e.g. Metadata.habitat)
              var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
              var tmpJsonRef = resolveJsonColumnPath(tmpFilter[i].Column, tmpSchema);
              if (tmpJsonRef) {
                tmpWhere += ' JSON_EXTRACT(`' + tmpJsonRef.column + "`, '" + tmpJsonRef.path + "') " + tmpFilter[i].Operator + ' :' + tmpColumnParameter;
              } else {
                // Add the column name, operator and parameter name to the list of where value parenthetical
                tmpWhere += ' ' + tmpFilter[i].Column + ' ' + tmpFilter[i].Operator + ' :' + tmpColumnParameter;
              }
              pParameters.query.parameters[tmpColumnParameter] = tmpFilter[i].Value;
            }
          }
          return tmpWhere;
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
        var findIdentityColumn = function findIdentityColumn(pParameters) {
          var tmpQuery = pParameters.query && typeof pParameters.query === 'object' ? pParameters.query : {};
          var tmpSchema = Array.isArray(tmpQuery.schema) ? tmpQuery.schema : [];
          for (var i = 0; i < tmpSchema.length; i++) {
            if (tmpSchema[i].Type === 'AutoIdentity') {
              return tmpSchema[i].Column;
            }
          }
          if (typeof tmpQuery.defaultIdentifier === 'string' && tmpQuery.defaultIdentifier) {
            for (var j = 0; j < tmpSchema.length; j++) {
              if (tmpSchema[j].Column === tmpQuery.defaultIdentifier) {
                return tmpQuery.defaultIdentifier;
              }
            }
          }
          return null;
        };

        /**
        * Resolve the sort a capped read should actually run with.
        *
        * LIMIT/OFFSET over a sort that isn't a total order has no defined paging
        * behavior: pages can overlap and drop rows.  InnoDB is stable enough in
        * practice on simple scans that this rarely surfaces, but nothing in the
        * engine promises it once the plan changes.  Appending the identity column
        * makes the order total, so pages partition the result set.  A
        * caller-supplied sort still leads; the identity column only breaks ties.
        *
        * @method: resolveStableSort
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {Array} The sort array to emit
        */
        var resolveStableSort = function resolveStableSort(pParameters) {
          var tmpSort = Array.isArray(pParameters.sort) ? pParameters.sort.slice() : [];

          // Only paged reads need a total order.  DISTINCT rejects an ORDER BY
          // term that isn't in the select list, and a query override owns its own
          // clause placement (it may be grouping), so neither can take one.
          if (!pParameters.cap || pParameters.distinct || pParameters.queryOverride || pParameters.disableStableSort) {
            return tmpSort;
          }
          var tmpIdentityColumn = findIdentityColumn(pParameters);
          if (!tmpIdentityColumn) {
            return tmpSort;
          }
          for (var i = 0; i < tmpSort.length; i++) {
            if (String(tmpSort[i].Column).split('.').pop() === tmpIdentityColumn) {
              // Already a total order.
              return tmpSort;
            }
          }

          // A join can bring in a same-named identity column from another table,
          // which would make an unqualified ORDER BY ambiguous.
          var tmpColumn = tmpIdentityColumn;
          if (Array.isArray(pParameters.join) && pParameters.join.length > 0 && typeof pParameters.scope === 'string' && pParameters.scope.indexOf('.') < 0 && pParameters.scope.indexOf('`') < 0) {
            tmpColumn = pParameters.scope + '.' + tmpIdentityColumn;
          }
          tmpSort.push({
            Column: tmpColumn,
            Direction: 'Ascending'
          });
          return tmpSort;
        };

        /**
        * Generate an ORDER BY clause from the sort array
        *
        * Each entry in the sort is an object like:
        * {Column:'Color',Direction:'Descending'}
        *
        * @method: generateOrderBy
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the field list clause
        */
        var generateOrderBy = function generateOrderBy(pParameters) {
          var tmpOrderBy = resolveStableSort(pParameters);
          if (!Array.isArray(tmpOrderBy) || tmpOrderBy.length < 1) {
            return '';
          }
          var tmpOrderClause = ' ORDER BY';
          for (var i = 0; i < tmpOrderBy.length; i++) {
            if (i > 0) {
              tmpOrderClause += ',';
            }
            tmpOrderClause += ' ' + tmpOrderBy[i].Column;
            if (tmpOrderBy[i].Direction == 'Descending') {
              tmpOrderClause += ' DESC';
            }
          }
          return tmpOrderClause;
        };

        /**
        * Generate the limit clause
        *
        * @method: generateLimit
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table limit clause
        */
        var generateLimit = function generateLimit(pParameters) {
          if (!pParameters.cap) {
            return '';
          }
          var tmpLimit = ' LIMIT';
          // If there is a begin record, we'll pass that in as well.
          if (pParameters.begin !== false) {
            tmpLimit += ' ' + pParameters.begin + ',';
          }
          // Cap is required for a limit clause.
          tmpLimit += ' ' + pParameters.cap;
          return tmpLimit;
        };

        /**
        * Generate the use index clause
        *
        * @method: generateIndexHints
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table limit clause
        */
        var generateIndexHints = function generateIndexHints(pParameters) {
          if (!Array.isArray(pParameters.indexHints) || pParameters.indexHints.length < 1) {
            return '';
          }
          return " USE INDEX (".concat(pParameters.indexHints.join(','), ")");
        };

        /**
        * Generate the join clause
        *
        * @method: generateJoins
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the join clause
        */
        var generateJoins = function generateJoins(pParameters) {
          var tmpJoins = pParameters.join;
          if (!Array.isArray(tmpJoins) || tmpJoins.length < 1) {
            return '';
          }
          var tmpJoinClause = ''; //ex. ' INNER JOIN';
          for (var i = 0; i < tmpJoins.length; i++) {
            var join = tmpJoins[i];
            //verify that all required fields are valid
            if (join.Type && join.Table && join.From && join.To) {
              tmpJoinClause += " ".concat(join.Type, " ").concat(join.Table, " ON ").concat(join.From, " = ").concat(join.To);
            }
          }
          return tmpJoinClause;
        };

        /**
        * Generate the update SET clause
        *
        * @method: generateUpdateSetters
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table name clause
        */
        var generateUpdateSetters = function generateUpdateSetters(pParameters) {
          var tmpRecords = pParameters.query.records;
          // We need to tell the query not to generate improperly if there are no values to set.
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }

          // Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpUpdate = '';
          // If there is more than one record in records, we are going to ignore them for now.
          var tmpCurrentColumn = 0;
          for (var tmpColumn in tmpRecords[0]) {
            // No hash table yet, so, we will just linear search it for now.
            // This uses the schema to decide if we want to treat a column differently on insert
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                // There is a schema entry for it.  Process it accordingly.
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (pParameters.query.disableAutoUserStamp && tmpSchemaEntry.Type === 'UpdateIDUser') {
              // This is ignored if flag is set
              continue;
            }
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
              case 'CreateDate':
              case 'CreateIDUser':
              case 'DeleteDate':
              case 'DeleteIDUser':
                // These are all ignored on update
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            switch (tmpSchemaEntry.Type) {
              case 'UpdateDate':
                if (pParameters.query.disableAutoDateStamp) {
                  // Manual mode: use the record's value as-is
                  var tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                  tmpUpdate += ' ' + tmpColumn + ' = :' + tmpColumnParameter;
                  pParameters.query.parameters[tmpColumnParameter] = tmpRecords[0][tmpColumn];
                } else {
                  tmpUpdate += ' ' + tmpColumn + ' = ' + SQL_NOW;
                }
                break;
              case 'UpdateIDUser':
                // This is the user ID, which we hope is in the query.
                // This is how to deal with a normal column
                var tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + tmpColumn + ' = :' + tmpColumnParameter;
                // Set the query parameter
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                break;
              case 'JSON':
                var tmpJSONUpdateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + tmpColumn + ' = :' + tmpJSONUpdateParam;
                pParameters.query.parameters[tmpJSONUpdateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                break;
              case 'JSONProxy':
                var tmpProxyUpdateParam = tmpSchemaEntry.StorageColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + tmpSchemaEntry.StorageColumn + ' = :' + tmpProxyUpdateParam;
                pParameters.query.parameters[tmpProxyUpdateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                break;
              default:
                var tmpColumnDefaultParameter = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + tmpColumn + ' = :' + tmpColumnDefaultParameter;

                // Set the query parameter
                pParameters.query.parameters[tmpColumnDefaultParameter] = tmpRecords[0][tmpColumn];
                break;
            }

            // We use a number to make sure parameters are unique.
            tmpCurrentColumn++;
          }

          // We need to tell the query not to generate improperly if there are no values set.
          if (tmpUpdate === '') {
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
        var generateUpdateDeleteSetters = function generateUpdateDeleteSetters(pParameters) {
          if (pParameters.query.disableDeleteTracking) {
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
          var tmpSchemaEntry = {
            Type: 'Default'
          };
          for (var i = 0; i < tmpSchema.length; i++) {
            // There is a schema entry for it.  Process it accordingly.
            tmpSchemaEntry = tmpSchema[i];
            var tmpUpdateSql = null;
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpUpdateSql = ' ' + tmpSchemaEntry.Column + ' = 1';
                tmpHasDeletedField = true; //this field is required in order for query to be built
                break;
              case 'DeleteDate':
                tmpUpdateSql = ' ' + tmpSchemaEntry.Column + ' = ' + SQL_NOW;
                break;
              case 'UpdateDate':
                // Delete operation is an Update, so we should stamp the update time
                tmpUpdateSql = ' ' + tmpSchemaEntry.Column + ' = ' + SQL_NOW;
                break;
              case 'DeleteIDUser':
                // This is the user ID, which we hope is in the query.
                // This is how to deal with a normal column
                var tmpColumnParameter = tmpSchemaEntry.Column + '_' + tmpCurrentColumn;
                tmpUpdateSql = ' ' + tmpSchemaEntry.Column + ' = :' + tmpColumnParameter;
                // Set the query parameter
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                break;
              default:
                //DON'T allow update of other fields in this query
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            tmpUpdate += tmpUpdateSql;

            // We use a number to make sure parameters are unique.
            tmpCurrentColumn++;
          }

          // We need to tell the query not to generate improperly if there are no values set.
          if (!tmpHasDeletedField || tmpUpdate === '') {
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
        var generateUpdateUndeleteSetters = function generateUpdateUndeleteSetters(pParameters) {
          // Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCurrentColumn = 0;
          var tmpHasDeletedField = false;
          var tmpUpdate = '';
          // No hash table yet, so, we will just linear search it for now.
          // This uses the schema to decide if we want to treat a column differently on insert
          var tmpSchemaEntry = {
            Type: 'Default'
          };
          for (var i = 0; i < tmpSchema.length; i++) {
            // There is a schema entry for it.  Process it accordingly.
            tmpSchemaEntry = tmpSchema[i];
            var tmpUpdateSql = null;
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpUpdateSql = ' ' + tmpSchemaEntry.Column + ' = 0';
                tmpHasDeletedField = true; //this field is required in order for query to be built
                break;
              case 'UpdateDate':
                // The undelete operation is an Update, so we should stamp the update time
                tmpUpdateSql = ' ' + tmpSchemaEntry.Column + ' = ' + SQL_NOW;
                break;
              case 'UpdateIDUser':
                var tmpColumnParameter = tmpSchemaEntry.Column + '_' + tmpCurrentColumn;
                tmpUpdateSql = ' ' + tmpSchemaEntry.Column + ' = :' + tmpColumnParameter;
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                break;
              default:
                //DON'T allow update of other fields in this query
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            tmpUpdate += tmpUpdateSql;

            // We use a number to make sure parameters are unique.
            tmpCurrentColumn++;
          }

          // We need to tell the query not to generate improperly if there are no values set.
          if (!tmpHasDeletedField || tmpUpdate === '') {
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
        var generateCreateSetValues = function generateCreateSetValues(pParameters) {
          var tmpRecords = pParameters.query.records;
          // We need to tell the query not to generate improperly if there are no values to set.
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }

          // Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCreateSet = '';
          // If there is more than one record in records, we are going to ignore them for now.
          var tmpCurrentColumn = 0;
          for (var tmpColumn in tmpRecords[0]) {
            // No hash table yet, so, we will just linear search it for now.
            // This uses the schema to decide if we want to treat a column differently on insert
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                // There is a schema entry for it.  Process it accordingly.
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (!pParameters.query.disableDeleteTracking) {
              if (tmpSchemaEntry.Type === 'DeleteDate' || tmpSchemaEntry.Type === 'DeleteIDUser') {
                // These are all ignored on insert (if delete tracking is enabled as normal)
                continue;
              }
            }
            if (tmpCurrentColumn > 0) {
              tmpCreateSet += ',';
            }

            //define a re-usable method for setting up field definitions in a default pattern
            var buildDefaultDefinition = function buildDefaultDefinition() {
              var tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
              tmpCreateSet += ' :' + tmpColumnParameter;
              // Set the query parameter
              pParameters.query.parameters[tmpColumnParameter] = tmpRecords[0][tmpColumn];
            };
            var tmpColumnParameter;
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
                if (pParameters.query.disableAutoIdentity) {
                  buildDefaultDefinition();
                } else {
                  // This is an autoidentity, so we don't parameterize it and just pass in NULL
                  tmpCreateSet += ' NULL';
                }
                break;
              case 'AutoGUID':
                if (pParameters.query.disableAutoIdentity) {
                  buildDefaultDefinition();
                } else if (tmpRecords[0][tmpColumn] && tmpRecords[0][tmpColumn].length >= 5 && tmpRecords[0][tmpColumn] !== '0x0000000000000000')
                  //stricture default
                  {
                    // Allow consumer to override AutoGUID
                    buildDefaultDefinition();
                  } else {
                  // This is an autoidentity, so we don't parameterize it and just pass in NULL
                  tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                  tmpCreateSet += ' :' + tmpColumnParameter;
                  // Set the query parameter
                  pParameters.query.parameters[tmpColumnParameter] = pParameters.query.UUID;
                }
                break;
              case 'UpdateDate':
              case 'CreateDate':
              case 'DeleteDate':
                if (pParameters.query.disableAutoDateStamp) {
                  buildDefaultDefinition();
                } else {
                  // This is an autoidentity, so we don't parameterize it and just pass in NULL
                  tmpCreateSet += ' ' + SQL_NOW;
                }
                break;
              case 'DeleteIDUser':
              case 'UpdateIDUser':
              case 'CreateIDUser':
                if (pParameters.query.disableAutoUserStamp) {
                  buildDefaultDefinition();
                } else {
                  // This is the user ID, which we hope is in the query.
                  // This is how to deal with a normal column
                  tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                  tmpCreateSet += ' :' + tmpColumnParameter;
                  // Set the query parameter
                  pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                }
                break;
              case 'JSON':
                var tmpJSONCreateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpCreateSet += ' :' + tmpJSONCreateParam;
                pParameters.query.parameters[tmpJSONCreateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                break;
              case 'JSONProxy':
                var tmpProxyCreateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpCreateSet += ' :' + tmpProxyCreateParam;
                pParameters.query.parameters[tmpProxyCreateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                break;
              default:
                buildDefaultDefinition();
                break;
            }

            // We use an appended number to make sure parameters are unique.
            tmpCurrentColumn++;
          }

          // We need to tell the query not to generate improperly if there are no values set.
          if (tmpCreateSet === '') {
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
        var generateCreateSetList = function generateCreateSetList(pParameters) {
          // The records were already validated by generateCreateSetValues
          var tmpRecords = pParameters.query.records;

          // Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCreateSet = '';
          // If there is more than one record in records, we are going to ignore them for now.
          for (var tmpColumn in tmpRecords[0]) {
            // No hash table yet, so, we will just linear search it for now.
            // This uses the schema to decide if we want to treat a column differently on insert
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                // There is a schema entry for it.  Process it accordingly.
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (!pParameters.query.disableDeleteTracking) {
              if (tmpSchemaEntry.Type === 'DeleteDate' || tmpSchemaEntry.Type === 'DeleteIDUser') {
                // These are all ignored on insert (if delete tracking is enabled as normal)
                continue;
              }
            }
            switch (tmpSchemaEntry.Type) {
              case 'JSON':
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' ' + tmpColumn;
                break;
              case 'JSONProxy':
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' ' + tmpSchemaEntry.StorageColumn;
                break;
              default:
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' ' + tmpColumn;
                break;
            }
          }
          return tmpCreateSet;
        };
        var Create = function Create(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpCreateSetList = generateCreateSetList(pParameters);
          var tmpCreateSetValues = generateCreateSetValues(pParameters);
          if (!tmpCreateSetValues) {
            return false;
          }
          return 'INSERT INTO' + tmpTableName + ' (' + tmpCreateSetList + ') VALUES (' + tmpCreateSetValues + ');';
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
        var Read = function Read(pParameters) {
          var tmpFieldList = generateFieldList(pParameters);
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpJoin = generateJoins(pParameters);
          var tmpOrderBy = generateOrderBy(pParameters);
          var tmpLimit = generateLimit(pParameters);
          var tmpIndexHints = generateIndexHints(pParameters);
          const tmpOptDistinct = pParameters.distinct ? ' DISTINCT' : '';
          if (pParameters.queryOverride) {
            try {
              var tmpQueryTemplate = _Fable.Utility.template(pParameters.queryOverride);
              return tmpQueryTemplate({
                FieldList: tmpFieldList,
                TableName: tmpTableName,
                Where: tmpWhere,
                Join: tmpJoin,
                OrderBy: tmpOrderBy,
                Limit: tmpLimit,
                IndexHints: tmpIndexHints,
                Distinct: tmpOptDistinct,
                _Params: pParameters
              });
            } catch (pError) {
              // This pokemon is here to give us a convenient way of not throwing up totally if the query fails.
              console.log('Error with custom Read Query [' + pParameters.queryOverride + ']: ' + pError);
              return false;
            }
          }
          return "SELECT".concat(tmpOptDistinct).concat(tmpFieldList, " FROM").concat(tmpTableName).concat(tmpIndexHints).concat(tmpJoin).concat(tmpWhere).concat(tmpOrderBy).concat(tmpLimit, ";");
        };
        var Update = function Update(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpUpdateSetters = generateUpdateSetters(pParameters);
          if (!tmpUpdateSetters) {
            return false;
          }
          return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateSetters + tmpWhere + ';';
        };
        var Delete = function Delete(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpUpdateDeleteSetters = generateUpdateDeleteSetters(pParameters);
          if (tmpUpdateDeleteSetters) {
            //If it has a deleted bit, update it instead of actually deleting the record
            return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateDeleteSetters + tmpWhere + ';';
          } else {
            return 'DELETE FROM' + tmpTableName + tmpWhere + ';';
          }
        };
        var Undelete = function Undelete(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          // TODO: Fix these
          let tmpDeleteTrackingState = pParameters.query.disableDeleteTracking;
          pParameters.query.disableDeleteTracking = true;
          var tmpWhere = generateWhere(pParameters);
          var tmpUpdateUndeleteSetters = generateUpdateUndeleteSetters(pParameters);
          pParameters.query.disableDeleteTracking = tmpDeleteTrackingState;
          if (tmpUpdateUndeleteSetters) {
            //If the table has a deleted bit, go forward with the update to change things.
            return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateUndeleteSetters + tmpWhere + ';';
          } else {
            // This is a no-op because the record can't be undeleted.
            // TODO: Should it throw instead?
            return 'SELECT NULL;';
          }
        };
        var Count = function Count(pParameters) {
          var tmpFieldList = pParameters.distinct ? generateFieldList(pParameters, true) : '*';
          var tmpTableName = generateTableName(pParameters);
          var tmpJoin = generateJoins(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpIndexHints = generateIndexHints(pParameters);
          // here, we ignore the distinct keyword if no fields have been specified and
          if (pParameters.distinct && tmpFieldList.length < 1) {
            console.warn('Distinct requested but no field list or schema are available, so not honoring distinct for count query.');
          }
          const tmpOptDistinct = pParameters.distinct && tmpFieldList.length > 0 ? 'DISTINCT' : '';
          if (pParameters.queryOverride) {
            try {
              var tmpQueryTemplate = _Fable.Utility.template(pParameters.queryOverride);
              return tmpQueryTemplate({
                FieldList: [],
                TableName: tmpTableName,
                Where: tmpWhere,
                OrderBy: '',
                Limit: '',
                IndexHints: tmpIndexHints,
                Distinct: tmpOptDistinct,
                _Params: pParameters
              });
            } catch (pError) {
              // This pokemon is here to give us a convenient way of not throwing up totally if the query fails.
              console.log('Error with custom Count Query [' + pParameters.queryOverride + ']: ' + pError);
              return false;
            }
          }
          return "SELECT COUNT(".concat(tmpOptDistinct).concat(tmpFieldList || '*', ") AS RowCount FROM").concat(tmpTableName).concat(tmpIndexHints).concat(tmpJoin).concat(tmpWhere, ";");
        };
        var tmpDialect = {
          Create: Create,
          Read: Read,
          Update: Update,
          Delete: Delete,
          Undelete: Undelete,
          Count: Count
        };

        /**
        * Dialect Name
        *
        * @property name
        * @type string
        */
        Object.defineProperty(tmpDialect, 'name', {
          get: function get() {
            return 'MySQL';
          },
          enumerable: true
        });
        return tmpDialect;
      };
      module.exports = FoxHoundDialectMySQL;
    }, {}],
    11: [function (require, module, exports) {
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

      var FoxHoundDialectOracle = function FoxHoundDialectOracle(pFable) {
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
        var generateTableName = function generateTableName(pParameters) {
          // Every Foxhound query has a table name; this lazily creates the
          // parameterTypes map even for column-less queries (e.g. COUNT(*)).
          if (!pParameters.query.hasOwnProperty('parameterTypes')) {
            pParameters.query.parameterTypes = {};
          }
          if (_QuoteIdentifiers) {
            if (pParameters.scope && pParameters.scope.indexOf('"') >= 0) {
              return ' ' + pParameters.scope;
            }
            return ' "' + pParameters.scope + '"';
          }
          return ' ' + pParameters.scope;
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
        var generateOracleParameterTypeEntry = function generateOracleParameterTypeEntry(pParameters, pColumnParameterName, pColumn) {
          if (!pParameters.query.hasOwnProperty('parameterTypes')) {
            pParameters.query.parameterTypes = {};
          }
          let tmpColumnParameterTypeString = 'String';
          if (typeof pColumn == 'object') {
            tmpColumnParameterTypeString = pColumn.Type;
          } else if (typeof pColumn == 'string') {
            var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            for (let i = 0; i < tmpSchema.length; i++) {
              if (tmpSchema[i].Column == pColumn) {
                tmpColumnParameterTypeString = tmpSchema[i].Type;
                break;
              }
            }
          } else {
            _Fable.log.warn("Meadow Oracle query attempted to add a parameter type but no valid column schema entry object or column name was passed; parameter name ".concat(pColumnParameterName, "."));
          }
          if (tmpColumnParameterTypeString == null || tmpColumnParameterTypeString == undefined) {
            return false;
          }
          switch (tmpColumnParameterTypeString) {
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
        var generateFieldList = function generateFieldList(pParameters, pIsForCountClause) {
          var tmpDataElements = pParameters.dataElements;
          if (!Array.isArray(tmpDataElements) || tmpDataElements.length < 1) {
            const tmpTableName = generateTableName(pParameters);
            if (!pIsForCountClause) {
              return tmpTableName + '.*';
            }
            // we need to list all of the table fields explicitly; get them from the schema
            const tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            if (tmpSchema.length < 1) {
              // this means we have no schema; returning an empty string here signals the calling code to handle this case
              return '';
            }
            const idColumn = tmpSchema.find(entry => entry.Type === 'AutoIdentity');
            if (!idColumn) {
              // this means there is no autoincrementing unique ID column; treat as above
              return '';
            }
            return " ".concat(generateSafeFieldName(idColumn.Column));
          }
          var tmpFieldList = ' ';
          for (var i = 0; i < tmpDataElements.length; i++) {
            if (i > 0) {
              tmpFieldList += ', ';
            }
            if (Array.isArray(tmpDataElements[i])) {
              tmpFieldList += generateSafeFieldName(tmpDataElements[i][0]);
              if (tmpDataElements[i].length > 1 && tmpDataElements[i][1]) {
                tmpFieldList += " AS " + generateSafeFieldName(tmpDataElements[i][1]);
              }
            } else {
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
        var generateOuterFieldListForLegacyPagination = function generateOuterFieldListForLegacyPagination(pParameters) {
          var tmpDataElements = pParameters.dataElements;
          if (Array.isArray(tmpDataElements) && tmpDataElements.length > 0) {
            return generateFieldList(pParameters);
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          if (tmpSchema.length > 0) {
            var tmpList = ' ';
            for (var i = 0; i < tmpSchema.length; i++) {
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
        const cleanseQuoting = str => {
          return str.replace(SURROUNDING_QUOTES_AND_WHITESPACE_REGEX, '');
        };

        /**
        * Ensure a field name is emitted correctly for the current quoting mode.
        *
        * Unquoted (default): bare identifiers (Oracle folds to UPPERCASE).
        * Quoted: wrapped in double quotes, preserving case.
        */
        var generateSafeFieldName = function generateSafeFieldName(pFieldName) {
          let pFieldNames = pFieldName.split('.');
          if (pFieldNames.length > 1) {
            const cleansedTable = cleanseQuoting(pFieldNames[0]);
            const cleansedFieldName = cleanseQuoting(pFieldNames[1]);
            if (cleansedFieldName === '*') {
              return _QuoteIdentifiers ? '"' + cleansedTable + '".*' : cleansedTable + '.*';
            }
            return _QuoteIdentifiers ? '"' + cleansedTable + '"."' + cleansedFieldName + '"' : cleansedTable + '.' + cleansedFieldName;
          }
          const cleansedFieldName = cleanseQuoting(pFieldNames[0]);
          if (cleansedFieldName === '*') {
            return '*';
          }
          return _QuoteIdentifiers ? '"' + cleansedFieldName + '"' : cleansedFieldName;
        };
        var resolveJsonColumnPath = function resolveJsonColumnPath(pColumnName, pSchema) {
          if (!Array.isArray(pSchema) || pSchema.length < 1) return null;
          var tmpParts = pColumnName.replace(/`/g, '').replace(/"/g, '').split('.');
          for (var tmpStartIdx = 0; tmpStartIdx < Math.min(tmpParts.length - 1, 2); tmpStartIdx++) {
            var tmpBaseColumn = tmpParts[tmpStartIdx];
            for (var s = 0; s < pSchema.length; s++) {
              if (pSchema[s].Column === tmpBaseColumn && (pSchema[s].Type === 'JSON' || pSchema[s].Type === 'JSONProxy')) {
                var tmpActualColumn = pSchema[s].Type === 'JSONProxy' ? pSchema[s].StorageColumn : tmpBaseColumn;
                var tmpJsonPath = '$.' + tmpParts.slice(tmpStartIdx + 1).join('.');
                return {
                  column: tmpActualColumn,
                  path: tmpJsonPath
                };
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
        var generateWhere = function generateWhere(pParameters) {
          var tmpFilter = Array.isArray(pParameters.filter) ? pParameters.filter : [];
          if (!pParameters.query.disableDeleteTracking) {
            // Check if there is a Deleted column on the Schema. If so, we add this to the filters automatically (if not already present)
            var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            for (var i = 0; i < tmpSchema.length; i++) {
              var tmpSchemaEntry = tmpSchema[i];
              if (tmpSchemaEntry.Type === 'Deleted') {
                var tmpHasDeletedParameter = false;
                if (tmpFilter.length > 0) {
                  for (var x = 0; x < tmpFilter.length; x++) {
                    if (tmpFilter[x].Column === tmpSchemaEntry.Column) {
                      tmpHasDeletedParameter = true;
                      break;
                    }
                  }
                }
                if (!tmpHasDeletedParameter) {
                  tmpFilter.push({
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
          if (tmpFilter.length < 1) {
            return '';
          }
          var tmpWhere = ' WHERE';

          // This is used to disable the connectors for subsequent queries.
          // Only the open parenthesis operator uses this, currently.
          var tmpLastOperatorNoConnector = false;
          for (var i = 0; i < tmpFilter.length; i++) {
            if (tmpFilter[i].Connector != 'NONE' && tmpFilter[i].Operator != ')' && tmpWhere != ' WHERE' && tmpLastOperatorNoConnector == false) {
              tmpWhere += ' ' + tmpFilter[i].Connector;
            }
            tmpLastOperatorNoConnector = false;
            var tmpColumnParameter;
            if (tmpFilter[i].Operator === '(') {
              tmpWhere += ' (';
              tmpLastOperatorNoConnector = true;
            } else if (tmpFilter[i].Operator === ')') {
              tmpWhere += ' )';
            } else if (tmpFilter[i].Operator === 'IN' || tmpFilter[i].Operator === "NOT IN") {
              // oracledb will not expand a single bound array into an IN list,
              // so expand the value list into discrete :name binds here.
              var tmpInValues = Array.isArray(tmpFilter[i].Value) ? tmpFilter[i].Value : String(tmpFilter[i].Value).split(',');
              var tmpInPlaceholders = [];
              for (var v = 0; v < tmpInValues.length; v++) {
                var tmpInParameter = tmpFilter[i].Parameter + '_w' + i + '_' + v;
                tmpInPlaceholders.push(':' + tmpInParameter);
                pParameters.query.parameters[tmpInParameter] = tmpInValues[v];
                generateOracleParameterTypeEntry(pParameters, tmpInParameter, tmpFilter[i].Parameter);
              }
              tmpWhere += ' ' + generateSafeFieldName(tmpFilter[i].Column) + ' ' + tmpFilter[i].Operator + ' (' + tmpInPlaceholders.join(', ') + ')';
            } else if (tmpFilter[i].Operator === 'IS NULL') {
              tmpWhere += ' ' + generateSafeFieldName(tmpFilter[i].Column) + ' ' + tmpFilter[i].Operator;
            } else if (tmpFilter[i].Operator === 'IS NOT NULL') {
              tmpWhere += ' ' + generateSafeFieldName(tmpFilter[i].Column) + ' ' + tmpFilter[i].Operator;
            } else {
              tmpColumnParameter = tmpFilter[i].Parameter + '_w' + i;
              var tmpSchemaForJson = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
              var tmpJsonRef = resolveJsonColumnPath(tmpFilter[i].Column, tmpSchemaForJson);
              if (tmpJsonRef) {
                tmpWhere += ' JSON_VALUE(' + generateSafeFieldName(tmpJsonRef.column) + ", '" + tmpJsonRef.path + "') " + tmpFilter[i].Operator + ' :' + tmpColumnParameter;
              } else {
                tmpWhere += ' ' + generateSafeFieldName(tmpFilter[i].Column) + ' ' + tmpFilter[i].Operator + ' :' + tmpColumnParameter;
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
        var findPrimaryKeyColumn = function findPrimaryKeyColumn(pParameters) {
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          for (var i = 0; i < tmpSchema.length; i++) {
            if (tmpSchema[i].Type === 'AutoIdentity') {
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
        var findIdentityColumn = function findIdentityColumn(pParameters) {
          var tmpQuery = pParameters.query && typeof pParameters.query === 'object' ? pParameters.query : {};
          var tmpSchema = Array.isArray(tmpQuery.schema) ? tmpQuery.schema : [];
          for (var i = 0; i < tmpSchema.length; i++) {
            if (tmpSchema[i].Type === 'AutoIdentity') {
              return tmpSchema[i].Column;
            }
          }
          if (typeof tmpQuery.defaultIdentifier === 'string' && tmpQuery.defaultIdentifier) {
            for (var j = 0; j < tmpSchema.length; j++) {
              if (tmpSchema[j].Column === tmpQuery.defaultIdentifier) {
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
        var resolveStableSort = function resolveStableSort(pParameters) {
          var tmpSort = Array.isArray(pParameters.sort) ? pParameters.sort.slice() : [];

          // Only paged reads need a total order.  DISTINCT rejects an ORDER BY
          // term that isn't in the select list, and a query override owns its own
          // clause placement (it may be grouping), so neither can take one.
          if (!pParameters.cap || pParameters.distinct || pParameters.queryOverride || pParameters.disableStableSort) {
            return tmpSort;
          }
          var tmpIdentityColumn = findIdentityColumn(pParameters);
          if (!tmpIdentityColumn) {
            return tmpSort;
          }
          for (var i = 0; i < tmpSort.length; i++) {
            if (String(tmpSort[i].Column).split('.').pop() === tmpIdentityColumn) {
              // Already a total order.
              return tmpSort;
            }
          }

          // A join can bring in a same-named identity column from another table,
          // which would make an unqualified ORDER BY ambiguous.
          var tmpColumn = tmpIdentityColumn;
          if (Array.isArray(pParameters.join) && pParameters.join.length > 0 && typeof pParameters.scope === 'string' && pParameters.scope.indexOf('.') < 0 && pParameters.scope.indexOf('"') < 0) {
            tmpColumn = pParameters.scope + '.' + tmpIdentityColumn;
          }
          tmpSort.push({
            Column: tmpColumn,
            Direction: 'Ascending'
          });
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
        var generateOrderBy = function generateOrderBy(pParameters) {
          var tmpOrderBy = resolveStableSort(pParameters);
          if (!Array.isArray(tmpOrderBy) || tmpOrderBy.length < 1) {
            return '';
          }
          var tmpOrderClause = ' ORDER BY';
          for (var i = 0; i < tmpOrderBy.length; i++) {
            if (i > 0) {
              tmpOrderClause += ',';
            }
            tmpOrderClause += ' ' + generateSafeFieldName(tmpOrderBy[i].Column);
            if (tmpOrderBy[i].Direction == 'Descending') {
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
        var generateLimit = function generateLimit(pParameters) {
          if (!pParameters.cap) {
            return '';
          }
          if (pParameters.legacyPagination) {
            return '';
          }
          var tmpLimit = ' OFFSET ';
          if (pParameters.begin !== false) {
            tmpLimit += pParameters.begin;
          } else {
            tmpLimit += '0';
          }
          tmpLimit += " ROWS FETCH NEXT ".concat(pParameters.cap, " ROWS ONLY");
          return tmpLimit;
        };

        /**
        * Generate the join clause
        *
        * @method: generateJoins
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the join clause
        */
        var generateJoins = function generateJoins(pParameters) {
          var tmpJoins = pParameters.join;
          if (!Array.isArray(tmpJoins) || tmpJoins.length < 1) {
            return '';
          }
          var tmpJoinClause = '';
          for (var i = 0; i < tmpJoins.length; i++) {
            var join = tmpJoins[i];
            if (join.Type && join.Table && join.From && join.To) {
              var tmpJoinTable = _QuoteIdentifiers ? '"' + join.Table + '"' : join.Table;
              tmpJoinClause += " ".concat(join.Type, " ").concat(tmpJoinTable, " ON ").concat(join.From, " = ").concat(join.To);
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
        var generateUpdateSetters = function generateUpdateSetters(pParameters) {
          var tmpRecords = pParameters.query.records;
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpUpdate = '';
          var tmpCurrentColumn = 0;
          for (var tmpColumn in tmpRecords[0]) {
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (pParameters.query.disableAutoUserStamp && tmpSchemaEntry.Type === 'UpdateIDUser') {
              continue;
            }
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
              case 'CreateDate':
              case 'CreateIDUser':
              case 'DeleteDate':
              case 'DeleteIDUser':
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            switch (tmpSchemaEntry.Type) {
              case 'UpdateDate':
                if (pParameters.query.disableAutoDateStamp) {
                  var tmpColumnParameter = 'MANUAL_UpdateDate';
                  tmpUpdate += ' ' + generateSafeFieldName(tmpColumn) + ' = :MANUAL_UpdateDate';
                  pParameters.query.parameters[tmpColumnParameter] = tmpRecords[0][tmpColumn];
                  generateOracleParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
                } else {
                  tmpUpdate += ' ' + generateSafeFieldName(tmpColumn) + ' = ' + SQL_NOW;
                }
                break;
              case 'UpdateIDUser':
                var tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + generateSafeFieldName(tmpColumn) + ' = :' + tmpColumnParameter;
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                generateOracleParameterTypeEntry(pParameters, tmpColumnParameter, tmpColumn);
                break;
              case 'JSON':
                var tmpJSONUpdateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + generateSafeFieldName(tmpColumn) + ' = :' + tmpJSONUpdateParam;
                pParameters.query.parameters[tmpJSONUpdateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                generateOracleParameterTypeEntry(pParameters, tmpJSONUpdateParam, {
                  Type: 'Text'
                });
                break;
              case 'JSONProxy':
                var tmpProxyUpdateParam = tmpSchemaEntry.StorageColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + generateSafeFieldName(tmpSchemaEntry.StorageColumn) + ' = :' + tmpProxyUpdateParam;
                pParameters.query.parameters[tmpProxyUpdateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                generateOracleParameterTypeEntry(pParameters, tmpProxyUpdateParam, {
                  Type: 'Text'
                });
                break;
              default:
                var tmpColumnDefaultParameter = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + generateSafeFieldName(tmpColumn) + ' = :' + tmpColumnDefaultParameter;
                pParameters.query.parameters[tmpColumnDefaultParameter] = tmpRecords[0][tmpColumn];
                generateOracleParameterTypeEntry(pParameters, tmpColumnDefaultParameter, tmpSchemaEntry);
                break;
            }
            tmpCurrentColumn++;
          }
          if (tmpUpdate === '') {
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
        var generateUpdateDeleteSetters = function generateUpdateDeleteSetters(pParameters) {
          if (pParameters.query.disableDeleteTracking) {
            return false;
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCurrentColumn = 0;
          var tmpHasDeletedField = false;
          var tmpUpdate = '';
          var tmpSchemaEntry = {
            Type: 'Default'
          };
          for (var i = 0; i < tmpSchema.length; i++) {
            tmpSchemaEntry = tmpSchema[i];
            var tmpUpdateSql = null;
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpUpdateSql = ' ' + generateSafeFieldName(tmpSchemaEntry.Column) + ' = 1';
                tmpHasDeletedField = true;
                break;
              case 'DeleteDate':
                tmpUpdateSql = ' ' + generateSafeFieldName(tmpSchemaEntry.Column) + ' = ' + SQL_NOW;
                break;
              case 'UpdateDate':
                tmpUpdateSql = ' ' + generateSafeFieldName(tmpSchemaEntry.Column) + ' = ' + SQL_NOW;
                break;
              case 'DeleteIDUser':
                var tmpColumnParameter = tmpSchemaEntry.Column + '_' + tmpCurrentColumn;
                tmpUpdateSql = ' ' + generateSafeFieldName(tmpSchemaEntry.Column) + ' = :' + tmpColumnParameter;
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                generateOracleParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
                break;
              default:
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            tmpUpdate += tmpUpdateSql;
            tmpCurrentColumn++;
          }
          if (!tmpHasDeletedField || tmpUpdate === '') {
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
        var generateUpdateUndeleteSetters = function generateUpdateUndeleteSetters(pParameters) {
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCurrentColumn = 0;
          var tmpHasDeletedField = false;
          var tmpUpdate = '';
          var tmpSchemaEntry = {
            Type: 'Default'
          };
          for (var i = 0; i < tmpSchema.length; i++) {
            tmpSchemaEntry = tmpSchema[i];
            var tmpUpdateSql = null;
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpUpdateSql = ' ' + generateSafeFieldName(tmpSchemaEntry.Column) + ' = 0';
                tmpHasDeletedField = true;
                break;
              case 'UpdateDate':
                tmpUpdateSql = ' ' + generateSafeFieldName(tmpSchemaEntry.Column) + ' = ' + SQL_NOW;
                break;
              case 'UpdateIDUser':
                var tmpColumnParameter = tmpSchemaEntry.Column + '_' + tmpCurrentColumn;
                tmpUpdateSql = ' ' + generateSafeFieldName(tmpSchemaEntry.Column) + ' = :' + tmpColumnParameter;
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                generateOracleParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
                break;
              default:
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            tmpUpdate += tmpUpdateSql;
            tmpCurrentColumn++;
          }
          if (!tmpHasDeletedField || tmpUpdate === '') {
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
        var generateCreateSetValues = function generateCreateSetValues(pParameters) {
          var tmpRecords = pParameters.query.records;
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCreateSet = '';
          var tmpCurrentColumn = 0;
          for (var tmpColumn in tmpRecords[0]) {
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (!pParameters.query.disableDeleteTracking) {
              if (tmpSchemaEntry.Type === 'DeleteDate' || tmpSchemaEntry.Type === 'DeleteIDUser') {
                continue;
              }
            }

            // AutoIdentity is omitted entirely from the INSERT (the IDENTITY
            // column or the BEFORE-INSERT sequence trigger supplies it); skip
            // adding a separator for it unless the consumer is overriding it.
            if (tmpSchemaEntry.Type === 'AutoIdentity' && !pParameters.query.disableAutoIdentity) {
              continue;
            }
            if (tmpCurrentColumn > 0 && tmpCreateSet != '') {
              tmpCreateSet += ',';
            }
            var buildDefaultDefinition = function buildDefaultDefinition() {
              var tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
              tmpCreateSet += ' :' + tmpColumnParameter;
              pParameters.query.parameters[tmpColumnParameter] = tmpRecords[0][tmpColumn];
              generateOracleParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
            };
            var tmpColumnParameter;
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
                // Only reached when disableAutoIdentity is set (overriding
                // the generated key with an explicit value).
                buildDefaultDefinition();
                break;
              case 'AutoGUID':
                if (pParameters.query.disableAutoIdentity) {
                  buildDefaultDefinition();
                } else if (tmpRecords[0][tmpColumn] && tmpRecords[0][tmpColumn].length >= 5 && tmpRecords[0][tmpColumn] !== '0x0000000000000000')
                  //stricture default
                  {
                    buildDefaultDefinition();
                  } else {
                  tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                  tmpCreateSet += ' :' + tmpColumnParameter;
                  pParameters.query.parameters[tmpColumnParameter] = pParameters.query.UUID;
                  generateOracleParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
                }
                break;
              case 'UpdateDate':
              case 'CreateDate':
              case 'DeleteDate':
                if (pParameters.query.disableAutoDateStamp) {
                  buildDefaultDefinition();
                } else {
                  tmpCreateSet += ' ' + SQL_NOW;
                }
                break;
              case 'DeleteIDUser':
              case 'UpdateIDUser':
              case 'CreateIDUser':
                if (pParameters.query.disableAutoUserStamp) {
                  buildDefaultDefinition();
                } else {
                  tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                  tmpCreateSet += ' :' + tmpColumnParameter;
                  pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                  generateOracleParameterTypeEntry(pParameters, tmpColumnParameter, tmpSchemaEntry);
                }
                break;
              case 'JSON':
                var tmpJSONCreateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpCreateSet += ' :' + tmpJSONCreateParam;
                pParameters.query.parameters[tmpJSONCreateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                generateOracleParameterTypeEntry(pParameters, tmpJSONCreateParam, {
                  Type: 'Text'
                });
                break;
              case 'JSONProxy':
                var tmpProxyCreateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpCreateSet += ' :' + tmpProxyCreateParam;
                pParameters.query.parameters[tmpProxyCreateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                generateOracleParameterTypeEntry(pParameters, tmpProxyCreateParam, {
                  Type: 'Text'
                });
                break;
              default:
                buildDefaultDefinition();
                break;
            }
            tmpCurrentColumn++;
          }
          if (tmpCreateSet === '') {
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
        var generateCreateSetList = function generateCreateSetList(pParameters) {
          var tmpRecords = pParameters.query.records;
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCreateSet = '';
          for (var tmpColumn in tmpRecords[0]) {
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (!pParameters.query.disableDeleteTracking) {
              if (tmpSchemaEntry.Type === 'DeleteDate' || tmpSchemaEntry.Type === 'DeleteIDUser') {
                continue;
              }
            }
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
                // Skipped on INSERT (IDENTITY/sequence trigger supplies it)
                // unless the consumer is overriding the value.
                if (pParameters.query.disableAutoIdentity) {
                  if (tmpCreateSet != '') {
                    tmpCreateSet += ',';
                  }
                  tmpCreateSet += ' ' + generateSafeFieldName(tmpColumn);
                }
                continue;
              case 'JSONProxy':
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' ' + generateSafeFieldName(tmpSchemaEntry.StorageColumn);
                break;
              default:
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' ' + generateSafeFieldName(tmpColumn);
                break;
            }
          }
          return tmpCreateSet;
        };
        var Create = function Create(pParameters) {
          _QuoteIdentifiers = !!pParameters.quoteIdentifiers;
          var tmpTableName = generateTableName(pParameters);
          var tmpCreateSetList = generateCreateSetList(pParameters);
          var tmpCreateSetValues = generateCreateSetValues(pParameters);
          if (!tmpCreateSetValues) {
            return false;
          }

          // Oracle has no SCOPE_IDENTITY(); return the generated key via a
          // RETURNING ... INTO out-bind that the Meadow Oracle provider reads.
          var tmpReturning = '';
          if (!pParameters.query.disableAutoIdentity) {
            var tmpIDColumn = findPrimaryKeyColumn(pParameters);
            if (tmpIDColumn) {
              tmpReturning = ' RETURNING ' + generateSafeFieldName(tmpIDColumn) + ' INTO :RETURNING_ID';
            }
          }
          return 'INSERT INTO' + tmpTableName + ' (' + tmpCreateSetList + ') VALUES (' + tmpCreateSetValues + ')' + tmpReturning;
        };

        /**
        * Read one or many records
        *
        * @method Read
        * @param {Object} pParameters SQL Query parameters
        * @return {String} Returns the generated query.
        */
        var Read = function Read(pParameters) {
          _QuoteIdentifiers = !!pParameters.quoteIdentifiers;
          var tmpFieldList = generateFieldList(pParameters);
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpJoin = generateJoins(pParameters);
          var tmpOrderBy = generateOrderBy(pParameters);
          var tmpLimit = generateLimit(pParameters);
          const tmpOptDistinct = pParameters.distinct ? ' DISTINCT' : '';
          if (pParameters.queryOverride) {
            try {
              var tmpQueryTemplate = _Fable.Utility.template(pParameters.queryOverride);
              return tmpQueryTemplate({
                FieldList: tmpFieldList,
                TableName: tmpTableName,
                Where: tmpWhere,
                Join: tmpJoin,
                OrderBy: tmpOrderBy,
                Limit: tmpLimit,
                Distinct: tmpOptDistinct,
                _Params: pParameters
              });
            } catch (pError) {
              console.log('Error with custom Read Query [' + pParameters.queryOverride + ']: ' + pError);
              return false;
            }
          }

          // Legacy pagination path — wrap in a ROWNUM double-subquery for 11g
          // and earlier, which have no OFFSET/FETCH.  The innermost query keeps
          // the ORDER BY; the middle query captures ROWNUM with an upper-bound
          // predicate (enabling a COUNT STOPKEY short-circuit); the outer query
          // applies the lower bound.  Enabled via pParameters.legacyPagination
          // (forwarded from the meadow-connection-oracle LegacyPagination config).
          if (pParameters.legacyPagination && pParameters.cap) {
            var tmpBegin = pParameters.begin !== false ? pParameters.begin : 0;
            var tmpEnd = tmpBegin + pParameters.cap;
            var tmpOuterFieldList = generateOuterFieldListForLegacyPagination(pParameters);
            return "SELECT".concat(tmpOptDistinct).concat(tmpOuterFieldList, " FROM (SELECT meadow_inner.*, ROWNUM AS \"_RowNum\" FROM (SELECT").concat(tmpFieldList, " FROM").concat(tmpTableName).concat(tmpJoin).concat(tmpWhere).concat(tmpOrderBy, ") meadow_inner WHERE ROWNUM <= ").concat(tmpEnd, ") WHERE \"_RowNum\" > ").concat(tmpBegin);
          }
          return "SELECT".concat(tmpOptDistinct).concat(tmpFieldList, " FROM").concat(tmpTableName).concat(tmpJoin).concat(tmpWhere).concat(tmpOrderBy).concat(tmpLimit);
        };
        var Update = function Update(pParameters) {
          _QuoteIdentifiers = !!pParameters.quoteIdentifiers;
          var tmpTableName = generateTableName(pParameters);
          var tmpUpdateSetters = generateUpdateSetters(pParameters);
          var tmpWhere = generateWhere(pParameters);
          if (!tmpUpdateSetters) {
            return false;
          }
          return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateSetters + tmpWhere;
        };
        var Delete = function Delete(pParameters) {
          _QuoteIdentifiers = !!pParameters.quoteIdentifiers;
          var tmpTableName = generateTableName(pParameters);
          var tmpUpdateDeleteSetters = generateUpdateDeleteSetters(pParameters);
          var tmpWhere = generateWhere(pParameters);
          if (tmpUpdateDeleteSetters) {
            return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateDeleteSetters + tmpWhere;
          } else {
            return 'DELETE FROM' + tmpTableName + tmpWhere;
          }
        };
        var Undelete = function Undelete(pParameters) {
          _QuoteIdentifiers = !!pParameters.quoteIdentifiers;
          var tmpTableName = generateTableName(pParameters);
          let tmpDeleteTrackingState = pParameters.query.disableDeleteTracking;
          pParameters.query.disableDeleteTracking = true;
          var tmpUpdateUndeleteSetters = generateUpdateUndeleteSetters(pParameters);
          var tmpWhere = generateWhere(pParameters);
          pParameters.query.disableDeleteTracking = tmpDeleteTrackingState;
          if (tmpUpdateUndeleteSetters) {
            return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateUndeleteSetters + tmpWhere;
          } else {
            // No-op — the record can't be undeleted.  Oracle requires a FROM.
            return 'SELECT NULL FROM DUAL';
          }
        };
        var Count = function Count(pParameters) {
          _QuoteIdentifiers = !!pParameters.quoteIdentifiers;
          var tmpFieldList = pParameters.distinct ? generateFieldList(pParameters, true) : '*';
          var tmpTableName = generateTableName(pParameters);
          var tmpJoin = generateJoins(pParameters);
          var tmpWhere = generateWhere(pParameters);
          if (pParameters.distinct && tmpFieldList.length < 1) {
            console.warn('Distinct requested but no field list or schema are available, so not honoring distinct for count query.');
          }
          const tmpOptDistinct = pParameters.distinct && tmpFieldList.length > 0 ? 'DISTINCT' : '';
          if (pParameters.queryOverride) {
            try {
              var tmpQueryTemplate = _Fable.Utility.template(pParameters.queryOverride);
              return tmpQueryTemplate({
                FieldList: [],
                TableName: tmpTableName,
                Where: tmpWhere,
                OrderBy: '',
                Limit: '',
                Distinct: tmpOptDistinct,
                _Params: pParameters
              });
            } catch (pError) {
              console.log('Error with custom Count Query [' + pParameters.queryOverride + ']: ' + pError);
              return false;
            }
          }
          return "SELECT COUNT(".concat(tmpOptDistinct).concat(tmpFieldList || '*', ") AS RowCount FROM").concat(tmpTableName).concat(tmpJoin).concat(tmpWhere);
        };
        var tmpDialect = {
          Create: Create,
          Read: Read,
          Update: Update,
          Delete: Delete,
          Undelete: Undelete,
          Count: Count
        };

        /**
        * Dialect Name
        *
        * @property name
        * @type string
        */
        Object.defineProperty(tmpDialect, 'name', {
          get: function get() {
            return 'Oracle';
          },
          enumerable: true
        });
        return tmpDialect;
      };
      module.exports = FoxHoundDialectOracle;
    }, {}],
    12: [function (require, module, exports) {
      /**
      * FoxHound PostgreSQL Dialect
      *
      * @license MIT
      *
      * For a PostgreSQL query override:
      // An underscore template with the following values:
      //      <%= DataElements %> = Field1, Field2, Field3, Field4
      //      <%= Begin %>        = 0
      //      <%= Cap %>          = 10
      //      <%= Filter %>       = WHERE StartDate > $1
      //      <%= Sort %>         = ORDER BY Field1
      // The values are empty strings if they aren't set.
      *
      * @author Steven Velozo <steven@velozo.com>
      * @class FoxHoundDialectPostgreSQL
      */

      var FoxHoundDialectPostgreSQL = function FoxHoundDialectPostgreSQL(pFable) {
        const SQL_NOW = "NOW()";
        let _Fable = pFable;

        /**
        * Generate a table name from the scope
        *
        * @method: generateTableName
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table name clause
        */
        var generateTableName = function generateTableName(pParameters) {
          if (pParameters.scope && pParameters.scope.indexOf('"') >= 0) return ' ' + pParameters.scope + '';else return ' "' + pParameters.scope + '"';
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
        var generateFieldList = function generateFieldList(pParameters, pIsForCountClause) {
          var tmpDataElements = pParameters.dataElements;
          if (!Array.isArray(tmpDataElements) || tmpDataElements.length < 1) {
            const tmpTableName = generateTableName(pParameters);
            if (!pIsForCountClause) {
              return tmpTableName + '.*';
            }
            // we need to list all of the table fields explicitly; get them from the schema
            const tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            if (tmpSchema.length < 1) {
              // this means we have no schema; returning an empty string here signals the calling code to handle this case
              return '';
            }
            const idColumn = tmpSchema.find(entry => entry.Type === 'AutoIdentity');
            if (!idColumn) {
              // this means there is no autoincrementing unique ID column; treat as above
              return '';
            }
            const qualifiedIDColumn = "".concat(tmpTableName, ".").concat(idColumn.Column);
            return " ".concat(generateSafeFieldName(qualifiedIDColumn));
          }
          var tmpFieldList = ' ';
          for (var i = 0; i < tmpDataElements.length; i++) {
            if (i > 0) {
              tmpFieldList += ', ';
            }
            if (Array.isArray(tmpDataElements[i])) {
              tmpFieldList += generateSafeFieldName(tmpDataElements[i][0]);
              if (tmpDataElements[i].length > 1 && tmpDataElements[i][1]) {
                tmpFieldList += " AS " + generateSafeFieldName(tmpDataElements[i][1]);
              }
            } else {
              tmpFieldList += generateSafeFieldName(tmpDataElements[i]);
            }
          }
          return tmpFieldList;
        };
        const SURROUNDING_QUOTES_AND_WHITESPACE_REGEX = /^[" ]+|[" ]+$/g;
        const cleanseQuoting = str => {
          return str.replace(SURROUNDING_QUOTES_AND_WHITESPACE_REGEX, '');
        };

        /**
        * Ensure a field name is properly escaped with double quotes.
        */
        var generateSafeFieldName = function generateSafeFieldName(pFieldName) {
          let pFieldNames = pFieldName.split('.');
          if (pFieldNames.length > 1) {
            const cleansedFieldName = cleanseQuoting(pFieldNames[1]);
            if (cleansedFieldName === '*') {
              return '"' + cleanseQuoting(pFieldNames[0]) + '".*';
            }
            return '"' + cleanseQuoting(pFieldNames[0]) + '"."' + cleansedFieldName + '"';
          }
          const cleansedFieldName = cleanseQuoting(pFieldNames[0]);
          if (cleansedFieldName === '*') {
            return '*';
          }
          return '"' + cleanseQuoting(pFieldNames[0]) + '"';
        };
        var resolveJsonColumnPath = function resolveJsonColumnPath(pColumnName, pSchema) {
          if (!Array.isArray(pSchema) || pSchema.length < 1) return null;
          var tmpParts = pColumnName.replace(/`/g, '').replace(/"/g, '').split('.');
          for (var tmpStartIdx = 0; tmpStartIdx < Math.min(tmpParts.length - 1, 2); tmpStartIdx++) {
            var tmpBaseColumn = tmpParts[tmpStartIdx];
            for (var s = 0; s < pSchema.length; s++) {
              if (pSchema[s].Column === tmpBaseColumn && (pSchema[s].Type === 'JSON' || pSchema[s].Type === 'JSONProxy')) {
                var tmpActualColumn = pSchema[s].Type === 'JSONProxy' ? pSchema[s].StorageColumn : tmpBaseColumn;
                var tmpJsonPath = '$.' + tmpParts.slice(tmpStartIdx + 1).join('.');
                return {
                  column: tmpActualColumn,
                  path: tmpJsonPath
                };
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
        var generateWhere = function generateWhere(pParameters) {
          var tmpFilter = Array.isArray(pParameters.filter) ? pParameters.filter : [];
          var tmpTableName = generateTableName(pParameters);
          if (!pParameters.query.disableDeleteTracking) {
            // Check if there is a Deleted column on the Schema. If so, we add this to the filters automatically (if not already present)
            var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            for (var i = 0; i < tmpSchema.length; i++) {
              var tmpSchemaEntry = tmpSchema[i];
              if (tmpSchemaEntry.Type === 'Deleted') {
                var tmpHasDeletedParameter = false;
                if (tmpFilter.length > 0) {
                  for (var x = 0; x < tmpFilter.length; x++) {
                    if (tmpFilter[x].Column === tmpSchemaEntry.Column) {
                      tmpHasDeletedParameter = true;
                      break;
                    }
                  }
                }
                if (!tmpHasDeletedParameter) {
                  tmpFilter.push({
                    Column: generateSafeFieldName(pParameters.scope + '.' + tmpSchemaEntry.Column),
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
          if (tmpFilter.length < 1) {
            return '';
          }
          var tmpWhere = ' WHERE';
          var tmpLastOperatorNoConnector = false;
          for (var i = 0; i < tmpFilter.length; i++) {
            if (tmpFilter[i].Connector != 'NONE' && tmpFilter[i].Operator != ')' && tmpWhere != ' WHERE' && tmpLastOperatorNoConnector == false) {
              tmpWhere += ' ' + tmpFilter[i].Connector;
            }
            tmpLastOperatorNoConnector = false;
            var tmpColumnParameter;
            if (tmpFilter[i].Operator === '(') {
              tmpWhere += ' (';
              tmpLastOperatorNoConnector = true;
            } else if (tmpFilter[i].Operator === ')') {
              tmpWhere += ' )';
            } else if (tmpFilter[i].Operator === 'IN' || tmpFilter[i].Operator === "NOT IN") {
              tmpColumnParameter = tmpFilter[i].Parameter + '_w' + i;
              tmpWhere += ' ' + generateSafeFieldName(tmpFilter[i].Column) + ' ' + tmpFilter[i].Operator + ' ( :' + tmpColumnParameter + ' )';
              pParameters.query.parameters[tmpColumnParameter] = tmpFilter[i].Value;
            } else if (tmpFilter[i].Operator === 'IS NULL') {
              tmpWhere += ' ' + generateSafeFieldName(tmpFilter[i].Column) + ' ' + tmpFilter[i].Operator;
            } else if (tmpFilter[i].Operator === 'IS NOT NULL') {
              tmpWhere += ' ' + generateSafeFieldName(tmpFilter[i].Column) + ' ' + tmpFilter[i].Operator;
            } else {
              tmpColumnParameter = tmpFilter[i].Parameter + '_w' + i;
              var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
              var tmpJsonRef = resolveJsonColumnPath(tmpFilter[i].Column, tmpSchema);
              if (tmpJsonRef) {
                var tmpPathParts = tmpJsonRef.path.replace('$.', '').split('.');
                if (tmpPathParts.length === 1) {
                  tmpWhere += ' "' + tmpJsonRef.column + '"' + "->>'" + tmpPathParts[0] + "' " + tmpFilter[i].Operator + ' :' + tmpColumnParameter;
                } else {
                  tmpWhere += ' "' + tmpJsonRef.column + '"' + "#>>'{" + tmpPathParts.join(',') + "}' " + tmpFilter[i].Operator + ' :' + tmpColumnParameter;
                }
              } else {
                tmpWhere += ' ' + generateSafeFieldName(tmpFilter[i].Column) + ' ' + tmpFilter[i].Operator + ' :' + tmpColumnParameter;
              }
              pParameters.query.parameters[tmpColumnParameter] = tmpFilter[i].Value;
            }
          }
          return tmpWhere;
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
        var findIdentityColumn = function findIdentityColumn(pParameters) {
          var tmpQuery = pParameters.query && typeof pParameters.query === 'object' ? pParameters.query : {};
          var tmpSchema = Array.isArray(tmpQuery.schema) ? tmpQuery.schema : [];
          for (var i = 0; i < tmpSchema.length; i++) {
            if (tmpSchema[i].Type === 'AutoIdentity') {
              return tmpSchema[i].Column;
            }
          }
          if (typeof tmpQuery.defaultIdentifier === 'string' && tmpQuery.defaultIdentifier) {
            for (var j = 0; j < tmpSchema.length; j++) {
              if (tmpSchema[j].Column === tmpQuery.defaultIdentifier) {
                return tmpQuery.defaultIdentifier;
              }
            }
          }
          return null;
        };

        /**
        * Resolve the sort a capped read should actually run with.
        *
        * LIMIT/OFFSET over a sort that isn't a total order has no defined paging
        * behavior: pages can overlap and drop rows.  PostgreSQL surfaces this
        * readily because synchronize_seqscans lets each page's sequential scan
        * start wherever the last one left off, on any relation over
        * shared_buffers/4.  Appending the identity column makes the order total, so
        * pages partition the result set.  A caller-supplied sort still leads; the
        * identity column only breaks ties.
        *
        * @method: resolveStableSort
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {Array} The sort array to emit
        */
        var resolveStableSort = function resolveStableSort(pParameters) {
          var tmpSort = Array.isArray(pParameters.sort) ? pParameters.sort.slice() : [];

          // Only paged reads need a total order.  DISTINCT rejects an ORDER BY
          // term that isn't in the select list, and a query override owns its own
          // clause placement (it may be grouping), so neither can take one.
          if (!pParameters.cap || pParameters.distinct || pParameters.queryOverride || pParameters.disableStableSort) {
            return tmpSort;
          }
          var tmpIdentityColumn = findIdentityColumn(pParameters);
          if (!tmpIdentityColumn) {
            return tmpSort;
          }
          for (var i = 0; i < tmpSort.length; i++) {
            if (String(tmpSort[i].Column).split('.').pop() === tmpIdentityColumn) {
              // Already a total order.
              return tmpSort;
            }
          }

          // A join can bring in a same-named identity column from another table,
          // which would make an unqualified ORDER BY ambiguous.
          var tmpColumn = tmpIdentityColumn;
          if (Array.isArray(pParameters.join) && pParameters.join.length > 0 && typeof pParameters.scope === 'string' && pParameters.scope.indexOf('.') < 0 && pParameters.scope.indexOf('"') < 0) {
            tmpColumn = pParameters.scope + '.' + tmpIdentityColumn;
          }
          tmpSort.push({
            Column: tmpColumn,
            Direction: 'Ascending'
          });
          return tmpSort;
        };

        /**
        * Generate an ORDER BY clause from the sort array
        *
        * Each entry in the sort is an object like:
        * {Column:'Color',Direction:'Descending'}
        *
        * @method: generateOrderBy
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the field list clause
        */
        var generateOrderBy = function generateOrderBy(pParameters) {
          var tmpOrderBy = resolveStableSort(pParameters);
          if (!Array.isArray(tmpOrderBy) || tmpOrderBy.length < 1) {
            return '';
          }
          var tmpOrderClause = ' ORDER BY';
          for (var i = 0; i < tmpOrderBy.length; i++) {
            if (i > 0) {
              tmpOrderClause += ',';
            }
            tmpOrderClause += ' ' + generateSafeFieldName(tmpOrderBy[i].Column);
            if (tmpOrderBy[i].Direction == 'Descending') {
              tmpOrderClause += ' DESC';
            }
          }
          return tmpOrderClause;
        };

        /**
        * Generate the limit clause using PostgreSQL LIMIT/OFFSET syntax
        *
        * @method: generateLimit
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table limit clause
        */
        var generateLimit = function generateLimit(pParameters) {
          if (!pParameters.cap) {
            return '';
          }
          var tmpLimit = ' LIMIT ' + pParameters.cap;
          if (pParameters.begin !== false) {
            tmpLimit += ' OFFSET ' + pParameters.begin;
          }
          return tmpLimit;
        };

        /**
        * Generate the join clause
        *
        * @method: generateJoins
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the join clause
        */
        var generateJoins = function generateJoins(pParameters) {
          var tmpJoins = pParameters.join;
          if (!Array.isArray(tmpJoins) || tmpJoins.length < 1) {
            return '';
          }
          var tmpJoinClause = '';
          for (var i = 0; i < tmpJoins.length; i++) {
            var join = tmpJoins[i];
            if (join.Type && join.Table && join.From && join.To) {
              tmpJoinClause += " ".concat(join.Type, " ").concat(join.Table, " ON ").concat(join.From, " = ").concat(join.To);
            }
          }
          return tmpJoinClause;
        };

        /**
        * Generate the update SET clause
        *
        * @method: generateUpdateSetters
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table name clause
        */
        var generateUpdateSetters = function generateUpdateSetters(pParameters) {
          var tmpRecords = pParameters.query.records;
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpUpdate = '';
          var tmpCurrentColumn = 0;
          for (var tmpColumn in tmpRecords[0]) {
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (pParameters.query.disableAutoUserStamp && tmpSchemaEntry.Type === 'UpdateIDUser') {
              continue;
            }
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
              case 'CreateDate':
              case 'CreateIDUser':
              case 'DeleteDate':
              case 'DeleteIDUser':
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            switch (tmpSchemaEntry.Type) {
              case 'UpdateDate':
                if (pParameters.query.disableAutoDateStamp) {
                  var tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                  tmpUpdate += ' ' + generateSafeFieldName(tmpColumn) + ' = :' + tmpColumnParameter;
                  pParameters.query.parameters[tmpColumnParameter] = tmpRecords[0][tmpColumn];
                } else {
                  tmpUpdate += ' ' + generateSafeFieldName(tmpColumn) + ' = ' + SQL_NOW;
                }
                break;
              case 'UpdateIDUser':
                var tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + generateSafeFieldName(tmpColumn) + ' = :' + tmpColumnParameter;
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                break;
              case 'JSON':
                var tmpJSONUpdateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + generateSafeFieldName(tmpColumn) + ' = :' + tmpJSONUpdateParam;
                pParameters.query.parameters[tmpJSONUpdateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                break;
              case 'JSONProxy':
                var tmpProxyUpdateParam = tmpSchemaEntry.StorageColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + generateSafeFieldName(tmpSchemaEntry.StorageColumn) + ' = :' + tmpProxyUpdateParam;
                pParameters.query.parameters[tmpProxyUpdateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                break;
              default:
                var tmpColumnDefaultParameter = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + generateSafeFieldName(tmpColumn) + ' = :' + tmpColumnDefaultParameter;
                pParameters.query.parameters[tmpColumnDefaultParameter] = tmpRecords[0][tmpColumn];
                break;
            }
            tmpCurrentColumn++;
          }
          if (tmpUpdate === '') {
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
        var generateUpdateDeleteSetters = function generateUpdateDeleteSetters(pParameters) {
          if (pParameters.query.disableDeleteTracking) {
            return false;
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCurrentColumn = 0;
          var tmpHasDeletedField = false;
          var tmpUpdate = '';
          var tmpSchemaEntry = {
            Type: 'Default'
          };
          for (var i = 0; i < tmpSchema.length; i++) {
            tmpSchemaEntry = tmpSchema[i];
            var tmpUpdateSql = null;
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpUpdateSql = ' ' + generateSafeFieldName(tmpSchemaEntry.Column) + ' = 1';
                tmpHasDeletedField = true;
                break;
              case 'DeleteDate':
                tmpUpdateSql = ' ' + generateSafeFieldName(tmpSchemaEntry.Column) + ' = ' + SQL_NOW;
                break;
              case 'UpdateDate':
                tmpUpdateSql = ' ' + generateSafeFieldName(tmpSchemaEntry.Column) + ' = ' + SQL_NOW;
                break;
              case 'DeleteIDUser':
                var tmpColumnParameter = tmpSchemaEntry.Column + '_' + tmpCurrentColumn;
                tmpUpdateSql = ' ' + generateSafeFieldName(tmpSchemaEntry.Column) + ' = :' + tmpColumnParameter;
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                break;
              default:
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            tmpUpdate += tmpUpdateSql;
            tmpCurrentColumn++;
          }
          if (!tmpHasDeletedField || tmpUpdate === '') {
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
        var generateUpdateUndeleteSetters = function generateUpdateUndeleteSetters(pParameters) {
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCurrentColumn = 0;
          var tmpHasDeletedField = false;
          var tmpUpdate = '';
          var tmpSchemaEntry = {
            Type: 'Default'
          };
          for (var i = 0; i < tmpSchema.length; i++) {
            tmpSchemaEntry = tmpSchema[i];
            var tmpUpdateSql = null;
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpUpdateSql = ' ' + generateSafeFieldName(tmpSchemaEntry.Column) + ' = 0';
                tmpHasDeletedField = true;
                break;
              case 'UpdateDate':
                tmpUpdateSql = ' ' + generateSafeFieldName(tmpSchemaEntry.Column) + ' = ' + SQL_NOW;
                break;
              case 'UpdateIDUser':
                var tmpColumnParameter = tmpSchemaEntry.Column + '_' + tmpCurrentColumn;
                tmpUpdateSql = ' ' + generateSafeFieldName(tmpSchemaEntry.Column) + ' = :' + tmpColumnParameter;
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                break;
              default:
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            tmpUpdate += tmpUpdateSql;
            tmpCurrentColumn++;
          }
          if (!tmpHasDeletedField || tmpUpdate === '') {
            return false;
          }
          return tmpUpdate;
        };

        /**
        * Generate the create SET clause values
        *
        * @method: generateCreateSetValues
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table name clause
        */
        var generateCreateSetValues = function generateCreateSetValues(pParameters) {
          var tmpRecords = pParameters.query.records;
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCreateSet = '';
          var tmpCurrentColumn = 0;
          for (var tmpColumn in tmpRecords[0]) {
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (!pParameters.query.disableDeleteTracking) {
              if (tmpSchemaEntry.Type === 'DeleteDate' || tmpSchemaEntry.Type === 'DeleteIDUser') {
                continue;
              }
            }
            if (tmpCurrentColumn > 0) {
              tmpCreateSet += ',';
            }
            var buildDefaultDefinition = function buildDefaultDefinition() {
              var tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
              tmpCreateSet += ' :' + tmpColumnParameter;
              pParameters.query.parameters[tmpColumnParameter] = tmpRecords[0][tmpColumn];
            };
            var tmpColumnParameter;
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
                if (pParameters.query.disableAutoIdentity) {
                  buildDefaultDefinition();
                } else {
                  // PostgreSQL SERIAL columns use DEFAULT rather than NULL
                  tmpCreateSet += ' DEFAULT';
                }
                break;
              case 'AutoGUID':
                if (pParameters.query.disableAutoIdentity) {
                  buildDefaultDefinition();
                } else if (tmpRecords[0][tmpColumn] && tmpRecords[0][tmpColumn].length >= 5 && tmpRecords[0][tmpColumn] !== '0x0000000000000000')
                  //stricture default
                  {
                    buildDefaultDefinition();
                  } else {
                  tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                  tmpCreateSet += ' :' + tmpColumnParameter;
                  pParameters.query.parameters[tmpColumnParameter] = pParameters.query.UUID;
                }
                break;
              case 'UpdateDate':
              case 'CreateDate':
              case 'DeleteDate':
                if (pParameters.query.disableAutoDateStamp) {
                  buildDefaultDefinition();
                } else {
                  tmpCreateSet += ' ' + SQL_NOW;
                }
                break;
              case 'DeleteIDUser':
              case 'UpdateIDUser':
              case 'CreateIDUser':
                if (pParameters.query.disableAutoUserStamp) {
                  buildDefaultDefinition();
                } else {
                  tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                  tmpCreateSet += ' :' + tmpColumnParameter;
                  pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                }
                break;
              case 'JSON':
                var tmpJSONCreateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpCreateSet += ' :' + tmpJSONCreateParam;
                pParameters.query.parameters[tmpJSONCreateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                break;
              case 'JSONProxy':
                var tmpProxyCreateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpCreateSet += ' :' + tmpProxyCreateParam;
                pParameters.query.parameters[tmpProxyCreateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                break;
              default:
                buildDefaultDefinition();
                break;
            }
            tmpCurrentColumn++;
          }
          if (tmpCreateSet === '') {
            return false;
          }
          return tmpCreateSet;
        };

        /**
        * Generate the create SET clause column list
        *
        * @method: generateCreateSetList
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table name clause
        */
        var generateCreateSetList = function generateCreateSetList(pParameters) {
          var tmpRecords = pParameters.query.records;
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCreateSet = '';
          for (var tmpColumn in tmpRecords[0]) {
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (!pParameters.query.disableDeleteTracking) {
              if (tmpSchemaEntry.Type === 'DeleteDate' || tmpSchemaEntry.Type === 'DeleteIDUser') {
                continue;
              }
            }
            switch (tmpSchemaEntry.Type) {
              case 'JSON':
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' ' + generateSafeFieldName(tmpColumn);
                break;
              case 'JSONProxy':
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' ' + generateSafeFieldName(tmpSchemaEntry.StorageColumn);
                break;
              default:
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' ' + generateSafeFieldName(tmpColumn);
                break;
            }
          }
          return tmpCreateSet;
        };
        var Create = function Create(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpCreateSetList = generateCreateSetList(pParameters);
          var tmpCreateSetValues = generateCreateSetValues(pParameters);
          if (!tmpCreateSetValues) {
            return false;
          }
          return 'INSERT INTO' + tmpTableName + ' (' + tmpCreateSetList + ') VALUES (' + tmpCreateSetValues + ') RETURNING *;';
        };

        /**
        * Read one or many records
        *
        * @method Read
        * @param {Object} pParameters SQL Query parameters
        * @return {String} Returns the current Query for chaining.
        */
        var Read = function Read(pParameters) {
          var tmpFieldList = generateFieldList(pParameters);
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpJoin = generateJoins(pParameters);
          var tmpOrderBy = generateOrderBy(pParameters);
          var tmpLimit = generateLimit(pParameters);
          const tmpOptDistinct = pParameters.distinct ? ' DISTINCT' : '';
          if (pParameters.queryOverride) {
            try {
              var tmpQueryTemplate = _Fable.Utility.template(pParameters.queryOverride);
              return tmpQueryTemplate({
                FieldList: tmpFieldList,
                TableName: tmpTableName,
                Where: tmpWhere,
                Join: tmpJoin,
                OrderBy: tmpOrderBy,
                Limit: tmpLimit,
                Distinct: tmpOptDistinct,
                _Params: pParameters
              });
            } catch (pError) {
              console.log('Error with custom Read Query [' + pParameters.queryOverride + ']: ' + pError);
              return false;
            }
          }
          return "SELECT".concat(tmpOptDistinct).concat(tmpFieldList, " FROM").concat(tmpTableName).concat(tmpJoin).concat(tmpWhere).concat(tmpOrderBy).concat(tmpLimit, ";");
        };
        var Update = function Update(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpUpdateSetters = generateUpdateSetters(pParameters);
          if (!tmpUpdateSetters) {
            return false;
          }
          return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateSetters + tmpWhere + ';';
        };
        var Delete = function Delete(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpUpdateDeleteSetters = generateUpdateDeleteSetters(pParameters);
          if (tmpUpdateDeleteSetters) {
            return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateDeleteSetters + tmpWhere + ';';
          } else {
            return 'DELETE FROM' + tmpTableName + tmpWhere + ';';
          }
        };
        var Undelete = function Undelete(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          let tmpDeleteTrackingState = pParameters.query.disableDeleteTracking;
          pParameters.query.disableDeleteTracking = true;
          var tmpWhere = generateWhere(pParameters);
          var tmpUpdateUndeleteSetters = generateUpdateUndeleteSetters(pParameters);
          pParameters.query.disableDeleteTracking = tmpDeleteTrackingState;
          if (tmpUpdateUndeleteSetters) {
            return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateUndeleteSetters + tmpWhere + ';';
          } else {
            return 'SELECT NULL;';
          }
        };
        var Count = function Count(pParameters) {
          var tmpFieldList = pParameters.distinct ? generateFieldList(pParameters, true) : '*';
          var tmpTableName = generateTableName(pParameters);
          var tmpJoin = generateJoins(pParameters);
          var tmpWhere = generateWhere(pParameters);
          if (pParameters.distinct && tmpFieldList.length < 1) {
            console.warn('Distinct requested but no field list or schema are available, so not honoring distinct for count query.');
          }
          const tmpOptDistinct = pParameters.distinct && tmpFieldList.length > 0 ? 'DISTINCT' : '';
          if (pParameters.queryOverride) {
            try {
              var tmpQueryTemplate = _Fable.Utility.template(pParameters.queryOverride);
              return tmpQueryTemplate({
                FieldList: [],
                TableName: tmpTableName,
                Where: tmpWhere,
                OrderBy: '',
                Limit: '',
                Distinct: tmpOptDistinct,
                _Params: pParameters
              });
            } catch (pError) {
              console.log('Error with custom Count Query [' + pParameters.queryOverride + ']: ' + pError);
              return false;
            }
          }
          return "SELECT COUNT(".concat(tmpOptDistinct).concat(tmpFieldList || '*', ") AS RowCount FROM").concat(tmpTableName).concat(tmpJoin).concat(tmpWhere, ";");
        };
        var tmpDialect = {
          Create: Create,
          Read: Read,
          Update: Update,
          Delete: Delete,
          Undelete: Undelete,
          Count: Count
        };

        /**
        * Dialect Name
        *
        * @property name
        * @type string
        */
        Object.defineProperty(tmpDialect, 'name', {
          get: function get() {
            return 'PostgreSQL';
          },
          enumerable: true
        });
        return tmpDialect;
      };
      module.exports = FoxHoundDialectPostgreSQL;
    }, {}],
    13: [function (require, module, exports) {
      /**
      * FoxHound SQLite Dialect
      *
      * @license MIT
      *
      * For an SQLite query override:
      // An underscore template with the following values:
      //      <%= DataElements %> = Field1, Field2, Field3, Field4
      //      <%= Begin %>        = 0
      //      <%= Cap %>          = 10
      //      <%= Filter %>       = WHERE StartDate > :MyStartDate
      //      <%= Sort %>         = ORDER BY Field1
      // The values are empty strings if they aren't set.
      
      // SQLite 3 also supports named parameters in 3 syntaxes: $name, @name, and :name.
      // To keep things simple and consistent with other providers, we'll use the :name syntax.
      *
      * @author Steven Velozo <steven@velozo.com>
      * @class FoxHoundDialectSQLite
      */

      var FoxHoundDialectSQLite = function FoxHoundDialectSQLite(pFable) {
        //Request time from SQL server with microseconds resolution
        const SQL_NOW = "NOW(3)";
        let _Fable = pFable;

        /**
        * Generate a table name from the scope.
        *
        * Because SQLite is all in-memory, and can be run in two modes (anonymous
        * working on arrays or table-based) we are going to make this a programmable
        * value.  Then we can share the code across both providers.
        *
        * @method: generateTableName
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table name clause
        */
        var generateTableName = function generateTableName(pParameters) {
          return ' ' + pParameters.scope;
        };

        /**
        * Escape columns, because SQLite has more reserved KWs than most SQL dialects
        */
        var escapeColumn = (pColumn, pParameters) => {
          if (pColumn.indexOf('.') < 0) {
            return '`' + pColumn + '`';
          } else {
            // This could suck if the scope is not the same
            var tmpTableName = pParameters.scope;
            if (pColumn.indexOf(tmpTableName + '.') > -1) {
              return '`' + pColumn.replace(tmpTableName + '.', '') + '`';
            } else {
              // This doesn't work well but we'll try it.
              return '`' + pColumn + '`';
            }
          }
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
        var generateFieldList = function generateFieldList(pParameters, pIsForCountClause) {
          var tmpDataElements = pParameters.dataElements;
          if (!Array.isArray(tmpDataElements) || tmpDataElements.length < 1) {
            if (!pIsForCountClause) {
              return ' *';
            }
            // we need to list all of the table fields explicitly; get them from the schema
            const tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            if (tmpSchema.length < 1) {
              // this means we have no schema; returning an empty string here signals the calling code to handle this case
              return '';
            }
            const idColumn = tmpSchema.find(entry => entry.Type === 'AutoIdentity');
            if (!idColumn) {
              // this means there is no autoincrementing unique ID column; treat as above
              return '';
            }
            return " ".concat(idColumn.Column);
          }
          var tmpFieldList = ' ';
          for (var i = 0; i < tmpDataElements.length; i++) {
            if (i > 0) {
              tmpFieldList += ', ';
            }
            tmpFieldList += escapeColumn(tmpDataElements[i], pParameters);
          }
          return tmpFieldList;
        };
        var resolveJsonColumnPath = function resolveJsonColumnPath(pColumnName, pSchema) {
          if (!Array.isArray(pSchema) || pSchema.length < 1) return null;
          var tmpParts = pColumnName.replace(/`/g, '').replace(/"/g, '').split('.');
          for (var tmpStartIdx = 0; tmpStartIdx < Math.min(tmpParts.length - 1, 2); tmpStartIdx++) {
            var tmpBaseColumn = tmpParts[tmpStartIdx];
            for (var s = 0; s < pSchema.length; s++) {
              if (pSchema[s].Column === tmpBaseColumn && (pSchema[s].Type === 'JSON' || pSchema[s].Type === 'JSONProxy')) {
                var tmpActualColumn = pSchema[s].Type === 'JSONProxy' ? pSchema[s].StorageColumn : tmpBaseColumn;
                var tmpJsonPath = '$.' + tmpParts.slice(tmpStartIdx + 1).join('.');
                return {
                  column: tmpActualColumn,
                  path: tmpJsonPath
                };
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
        var generateWhere = function generateWhere(pParameters) {
          var tmpFilter = Array.isArray(pParameters.filter) ? pParameters.filter : [];
          var tmpTableName = generateTableName(pParameters).trim();
          if (!pParameters.query.disableDeleteTracking) {
            // Check if there is a Deleted column on the Schema. If so, we add this to the filters automatically (if not already present)
            var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            for (var i = 0; i < tmpSchema.length; i++) {
              // There is a schema entry for it.  Process it accordingly.
              var tmpSchemaEntry = tmpSchema[i];
              if (tmpSchemaEntry.Type === 'Deleted') {
                var tmpHasDeletedParameter = false;

                //first, check to see if filters are already looking for Deleted column
                if (tmpFilter.length > 0) {
                  for (var x = 0; x < tmpFilter.length; x++) {
                    if (tmpFilter[x].Column === tmpSchemaEntry.Column) {
                      tmpHasDeletedParameter = true;
                      break;
                    }
                  }
                }
                if (!tmpHasDeletedParameter) {
                  //if not, we need to add it
                  tmpFilter.push({
                    Column: tmpTableName + '.' + tmpSchemaEntry.Column,
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
          if (tmpFilter.length < 1) {
            return '';
          }
          var tmpWhere = ' WHERE';

          // This is used to disable the connectors for subsequent queries.
          // Only the open parenthesis operator uses this, currently.
          var tmpLastOperatorNoConnector = false;
          for (var i = 0; i < tmpFilter.length; i++) {
            if (tmpFilter[i].Connector != 'NONE' && tmpFilter[i].Operator != ')' && tmpWhere != ' WHERE' && tmpLastOperatorNoConnector == false) {
              tmpWhere += ' ' + tmpFilter[i].Connector;
            }
            tmpLastOperatorNoConnector = false;
            var tmpColumnParameter;
            if (tmpFilter[i].Operator === '(') {
              // Open a logical grouping
              tmpWhere += ' (';
              tmpLastOperatorNoConnector = true;
            } else if (tmpFilter[i].Operator === ')') {
              // Close a logical grouping
              tmpWhere += ' )';
            } else if (tmpFilter[i].Operator === 'IN' || tmpFilter[i].Operator === 'NOT IN') {
              tmpColumnParameter = tmpFilter[i].Parameter + '_w' + i;
              // SQLite (better-sqlite3) cannot bind arrays as a single parameter.
              // Expand the array into individual named parameters for each element.
              var tmpFilterValue = tmpFilter[i].Value;
              if (Array.isArray(tmpFilterValue)) {
                var tmpParameterNames = [];
                for (var j = 0; j < tmpFilterValue.length; j++) {
                  var tmpElementParameter = tmpColumnParameter + '_' + j;
                  tmpParameterNames.push(':' + tmpElementParameter);
                  pParameters.query.parameters[tmpElementParameter] = tmpFilterValue[j];
                }
                tmpWhere += ' ' + escapeColumn(tmpFilter[i].Column, pParameters) + ' ' + tmpFilter[i].Operator + ' ( ' + tmpParameterNames.join(', ') + ' )';
              } else {
                // If for some reason the value is not an array, fall back to the old behavior
                tmpWhere += ' ' + escapeColumn(tmpFilter[i].Column, pParameters) + ' ' + tmpFilter[i].Operator + ' ( :' + tmpColumnParameter + ' )';
                pParameters.query.parameters[tmpColumnParameter] = tmpFilterValue;
              }
            } else if (tmpFilter[i].Operator === 'IS NOT NULL') {
              // IS NOT NULL is a special operator which doesn't require a value, or parameter
              tmpWhere += ' ' + escapeColumn(tmpFilter[i].Column, pParameters) + ' ' + tmpFilter[i].Operator;
            } else {
              tmpColumnParameter = tmpFilter[i].Parameter + '_w' + i;
              var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
              var tmpJsonRef = resolveJsonColumnPath(tmpFilter[i].Column, tmpSchema);
              if (tmpJsonRef) {
                tmpWhere += ' json_extract(`' + tmpJsonRef.column + "`, '" + tmpJsonRef.path + "') " + tmpFilter[i].Operator + ' :' + tmpColumnParameter;
              } else {
                tmpWhere += ' ' + escapeColumn(tmpFilter[i].Column, pParameters) + ' ' + tmpFilter[i].Operator + ' :' + tmpColumnParameter;
              }
              pParameters.query.parameters[tmpColumnParameter] = tmpFilter[i].Value;
            }
          }
          return tmpWhere;
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
        var findIdentityColumn = function findIdentityColumn(pParameters) {
          var tmpQuery = pParameters.query && typeof pParameters.query === 'object' ? pParameters.query : {};
          var tmpSchema = Array.isArray(tmpQuery.schema) ? tmpQuery.schema : [];
          for (var i = 0; i < tmpSchema.length; i++) {
            if (tmpSchema[i].Type === 'AutoIdentity') {
              return tmpSchema[i].Column;
            }
          }
          if (typeof tmpQuery.defaultIdentifier === 'string' && tmpQuery.defaultIdentifier) {
            for (var j = 0; j < tmpSchema.length; j++) {
              if (tmpSchema[j].Column === tmpQuery.defaultIdentifier) {
                return tmpQuery.defaultIdentifier;
              }
            }
          }
          return null;
        };

        /**
        * Resolve the sort a capped read should actually run with.
        *
        * LIMIT/OFFSET over a sort that isn't a total order has no defined paging
        * behavior: pages can overlap and drop rows.  Appending the identity column
        * makes the order total, so pages partition the result set.  A
        * caller-supplied sort still leads; the identity column only breaks ties.
        *
        * @method: resolveStableSort
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {Array} The sort array to emit
        */
        var resolveStableSort = function resolveStableSort(pParameters) {
          var tmpSort = Array.isArray(pParameters.sort) ? pParameters.sort.slice() : [];

          // Only paged reads need a total order.  DISTINCT rejects an ORDER BY
          // term that isn't in the select list, and a query override owns its own
          // clause placement (it may be grouping), so neither can take one.
          if (!pParameters.cap || pParameters.distinct || pParameters.queryOverride || pParameters.disableStableSort) {
            return tmpSort;
          }
          var tmpIdentityColumn = findIdentityColumn(pParameters);
          if (!tmpIdentityColumn) {
            return tmpSort;
          }
          for (var i = 0; i < tmpSort.length; i++) {
            if (String(tmpSort[i].Column).split('.').pop() === tmpIdentityColumn) {
              // Already a total order.
              return tmpSort;
            }
          }
          tmpSort.push({
            Column: tmpIdentityColumn,
            Direction: 'Ascending'
          });
          return tmpSort;
        };

        /**
        * Generate an ORDER BY clause from the sort array
        *
        * Each entry in the sort is an object like:
        * {Column:'Color',Direction:'Descending'}
        *
        * @method: generateOrderBy
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the field list clause
        */
        var generateOrderBy = function generateOrderBy(pParameters) {
          var tmpOrderBy = resolveStableSort(pParameters);
          if (!Array.isArray(tmpOrderBy) || tmpOrderBy.length < 1) {
            return '';
          }
          var tmpOrderClause = ' ORDER BY';
          for (var i = 0; i < tmpOrderBy.length; i++) {
            if (i > 0) {
              tmpOrderClause += ',';
            }
            tmpOrderClause += ' ' + escapeColumn(tmpOrderBy[i].Column, pParameters);
            if (tmpOrderBy[i].Direction == 'Descending') {
              tmpOrderClause += ' DESC';
            }
          }
          return tmpOrderClause;
        };

        /**
        * Generate the limit clause
        *
        * @method: generateLimit
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table name clause
        */
        var generateLimit = function generateLimit(pParameters) {
          if (!pParameters.cap) {
            return '';
          }
          var tmpLimit = ' LIMIT';
          // Cap is required for a limit clause.
          tmpLimit += ' ' + pParameters.cap;

          // If there is a begin record, we'll pass that in as well.
          if (pParameters.begin !== false) {
            tmpLimit += ' OFFSET ' + pParameters.begin;
          }
          return tmpLimit;
        };

        /**
        * Generate the update SET clause
        *
        * @method: generateUpdateSetters
        * @param: {Object} pParameters SQL Query Parameters
        * @return: {String} Returns the table name clause
        */
        var generateUpdateSetters = function generateUpdateSetters(pParameters) {
          var tmpRecords = pParameters.query.records;
          // We need to tell the query not to generate improperly if there are no values to set.
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }

          // Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpUpdate = '';
          // If there is more than one record in records, we are going to ignore them for now.
          var tmpCurrentColumn = 0;
          for (var tmpColumn in tmpRecords[0]) {
            // No hash table yet, so, we will just linear search it for now.
            // This uses the schema to decide if we want to treat a column differently on insert
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                // There is a schema entry for it.  Process it accordingly.
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (pParameters.query.disableAutoUserStamp && tmpSchemaEntry.Type === 'UpdateIDUser') {
              // This is ignored if flag is set
              continue;
            }
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
              case 'CreateDate':
              case 'CreateIDUser':
              case 'DeleteDate':
              case 'DeleteIDUser':
                // These are all ignored on update
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            switch (tmpSchemaEntry.Type) {
              case 'UpdateDate':
                if (pParameters.query.disableAutoDateStamp) {
                  // Manual mode: use the record's value as-is
                  var tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                  tmpUpdate += ' ' + escapeColumn(tmpColumn, pParameters) + ' = :' + tmpColumnParameter;
                  pParameters.query.parameters[tmpColumnParameter] = tmpRecords[0][tmpColumn];
                } else {
                  tmpUpdate += ' ' + escapeColumn(tmpColumn, pParameters) + ' = NOW()';
                }
                break;
              case 'UpdateIDUser':
                // This is the user ID, which we hope is in the query.
                // This is how to deal with a normal column
                var tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + escapeColumn(tmpColumn, pParameters) + ' = :' + tmpColumnParameter;
                // Set the query parameter
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                break;
              case 'JSON':
                var tmpJSONUpdateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + tmpColumn + ' = :' + tmpJSONUpdateParam;
                pParameters.query.parameters[tmpJSONUpdateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                break;
              case 'JSONProxy':
                var tmpProxyUpdateParam = tmpSchemaEntry.StorageColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + tmpSchemaEntry.StorageColumn + ' = :' + tmpProxyUpdateParam;
                pParameters.query.parameters[tmpProxyUpdateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                break;
              default:
                var tmpColumnDefaultParameter = tmpColumn + '_' + tmpCurrentColumn;
                tmpUpdate += ' ' + escapeColumn(tmpColumn, pParameters) + ' = :' + tmpColumnDefaultParameter;

                // Set the query parameter
                pParameters.query.parameters[tmpColumnDefaultParameter] = tmpRecords[0][tmpColumn];
                break;
            }

            // We use a number to make sure parameters are unique.
            tmpCurrentColumn++;
          }

          // We need to tell the query not to generate improperly if there are no values set.
          if (tmpUpdate === '') {
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
        var generateUpdateDeleteSetters = function generateUpdateDeleteSetters(pParameters) {
          if (pParameters.query.disableDeleteTracking) {
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
          var tmpSchemaEntry = {
            Type: 'Default'
          };
          for (var i = 0; i < tmpSchema.length; i++) {
            // There is a schema entry for it.  Process it accordingly.
            tmpSchemaEntry = tmpSchema[i];
            var tmpUpdateSql = null;
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpUpdateSql = ' ' + escapeColumn(tmpSchemaEntry.Column, pParameters) + ' = 1';
                tmpHasDeletedField = true; //this field is required in order for query to be built
                break;
              case 'DeleteDate':
                tmpUpdateSql = ' ' + escapeColumn(tmpSchemaEntry.Column, pParameters) + ' = NOW()';
                break;
              case 'UpdateDate':
                // Delete operation is an Update, so we should stamp the update time
                tmpUpdateSql = ' ' + escapeColumn(tmpSchemaEntry.Column, pParameters) + ' = NOW()';
                break;
              case 'DeleteIDUser':
                // This is the user ID, which we hope is in the query.
                // This is how to deal with a normal column
                var tmpColumnParameter = tmpSchemaEntry.Column + '_' + tmpCurrentColumn;
                tmpUpdateSql = ' ' + escapeColumn(tmpSchemaEntry.Column, pParameters) + ' = :' + tmpColumnParameter;
                // Set the query parameter
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                break;
              default:
                //DON'T allow update of other fields in this query
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            tmpUpdate += tmpUpdateSql;

            // We use a number to make sure parameters are unique.
            tmpCurrentColumn++;
          }

          // We need to tell the query not to generate improperly if there are no values set.
          if (!tmpHasDeletedField || tmpUpdate === '') {
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
        var generateUpdateUndeleteSetters = function generateUpdateUndeleteSetters(pParameters) {
          // Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCurrentColumn = 0;
          var tmpHasDeletedField = false;
          var tmpUpdate = '';
          // No hash table yet, so, we will just linear search it for now.
          // This uses the schema to decide if we want to treat a column differently on insert
          var tmpSchemaEntry = {
            Type: 'Default'
          };
          for (var i = 0; i < tmpSchema.length; i++) {
            // There is a schema entry for it.  Process it accordingly.
            tmpSchemaEntry = tmpSchema[i];
            var tmpUpdateSql = null;
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpUpdateSql = ' ' + escapeColumn(tmpSchemaEntry.Column, pParameters) + ' = 0';
                tmpHasDeletedField = true; //this field is required in order for query to be built
                break;
              case 'UpdateDate':
                // Delete operation is an Update, so we should stamp the update time
                tmpUpdateSql = ' ' + escapeColumn(tmpSchemaEntry.Column, pParameters) + ' = NOW()';
                break;
              case 'UpdateIDUser':
                // This is the user ID, which we hope is in the query.
                // This is how to deal with a normal column
                var tmpColumnParameter = tmpSchemaEntry.Column + '_' + tmpCurrentColumn;
                tmpUpdateSql = ' ' + escapeColumn(tmpSchemaEntry.Column, pParameters) + ' = :' + tmpColumnParameter;
                // Set the query parameter
                pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                break;
              default:
                //DON'T allow update of other fields in this query
                continue;
            }
            if (tmpCurrentColumn > 0) {
              tmpUpdate += ',';
            }
            tmpUpdate += tmpUpdateSql;

            // We use a number to make sure parameters are unique.
            tmpCurrentColumn++;
          }

          // We need to tell the query not to generate improperly if there are no values set.
          if (!tmpHasDeletedField || tmpUpdate === '') {
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
        var generateCreateSetValues = function generateCreateSetValues(pParameters) {
          var tmpRecords = pParameters.query.records;
          // We need to tell the query not to generate improperly if there are no values to set.
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }

          // Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCreateSet = '';
          // If there is more than one record in records, we are going to ignore them for now.
          var tmpCurrentColumn = 0;
          for (var tmpColumn in tmpRecords[0]) {
            // No hash table yet, so, we will just linear search it for now.
            // This uses the schema to decide if we want to treat a column differently on insert
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                // There is a schema entry for it.  Process it accordingly.
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (!pParameters.query.disableDeleteTracking) {
              if (tmpSchemaEntry.Type === 'DeleteDate' || tmpSchemaEntry.Type === 'DeleteIDUser') {
                // These are all ignored on insert (if delete tracking is enabled as normal)
                continue;
              }
            }
            if (tmpCurrentColumn > 0) {
              tmpCreateSet += ',';
            }

            //define a re-usable method for setting up field definitions in a default pattern
            var buildDefaultDefinition = function buildDefaultDefinition() {
              var tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
              tmpCreateSet += ' :' + tmpColumnParameter;
              // Set the query parameter
              pParameters.query.parameters[tmpColumnParameter] = tmpRecords[0][tmpColumn];
            };
            var tmpColumnParameter;
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
                if (pParameters.query.disableAutoIdentity) {
                  buildDefaultDefinition();
                } else {
                  // This is an autoidentity, so we don't parameterize it and just pass in NULL
                  tmpCreateSet += ' NULL';
                }
                break;
              case 'AutoGUID':
                if (pParameters.query.disableAutoIdentity) {
                  buildDefaultDefinition();
                } else if (tmpRecords[0][tmpColumn] && tmpRecords[0][tmpColumn].length >= 5 && tmpRecords[0][tmpColumn] !== '0x0000000000000000')
                  //stricture default
                  {
                    // Allow consumer to override AutoGUID
                    buildDefaultDefinition();
                  } else {
                  // This is an autoidentity, so we don't parameterize it and just pass in NULL
                  tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                  tmpCreateSet += ' :' + tmpColumnParameter;
                  // Set the query parameter
                  pParameters.query.parameters[tmpColumnParameter] = pParameters.query.UUID;
                }
                break;
              case 'UpdateDate':
              case 'CreateDate':
              case 'DeleteDate':
                if (pParameters.query.disableAutoDateStamp) {
                  buildDefaultDefinition();
                } else {
                  // This is an autoidentity, so we don't parameterize it and just pass in NULL
                  tmpCreateSet += ' NOW()';
                }
                break;
              case 'UpdateIDUser':
              case 'CreateIDUser':
              case 'DeleteIDUser':
                if (pParameters.query.disableAutoUserStamp) {
                  buildDefaultDefinition();
                } else {
                  // This is the user ID, which we hope is in the query.
                  // This is how to deal with a normal column
                  tmpColumnParameter = tmpColumn + '_' + tmpCurrentColumn;
                  tmpCreateSet += ' :' + tmpColumnParameter;
                  // Set the query parameter
                  pParameters.query.parameters[tmpColumnParameter] = pParameters.query.IDUser;
                }
                break;
              case 'JSON':
                var tmpJSONCreateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpCreateSet += ' :' + tmpJSONCreateParam;
                pParameters.query.parameters[tmpJSONCreateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                break;
              case 'JSONProxy':
                var tmpProxyCreateParam = tmpColumn + '_' + tmpCurrentColumn;
                tmpCreateSet += ' :' + tmpProxyCreateParam;
                pParameters.query.parameters[tmpProxyCreateParam] = typeof tmpRecords[0][tmpColumn] === 'string' ? tmpRecords[0][tmpColumn] : JSON.stringify(tmpRecords[0][tmpColumn] || {});
                break;
              default:
                buildDefaultDefinition();
                break;
            }

            // We use an appended number to make sure parameters are unique.
            tmpCurrentColumn++;
          }

          // We need to tell the query not to generate improperly if there are no values set.
          if (tmpCreateSet === '') {
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
        var generateCreateSetList = function generateCreateSetList(pParameters) {
          // The records were already validated by generateCreateSetValues
          var tmpRecords = pParameters.query.records;

          // Check if there is a schema.  If so, we will use it to decide if these are parameterized or not.
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpCreateSet = '';
          // If there is more than one record in records, we are going to ignore them for now.
          for (var tmpColumn in tmpRecords[0]) {
            // No hash table yet, so, we will just linear search it for now.
            // This uses the schema to decide if we want to treat a column differently on insert
            var tmpSchemaEntry = {
              Column: tmpColumn,
              Type: 'Default'
            };
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpColumn == tmpSchema[i].Column) {
                // There is a schema entry for it.  Process it accordingly.
                tmpSchemaEntry = tmpSchema[i];
                break;
              }
            }
            if (!pParameters.query.disableDeleteTracking) {
              if (tmpSchemaEntry.Type === 'DeleteDate' || tmpSchemaEntry.Type === 'DeleteIDUser') {
                // These are all ignored on insert (if delete tracking is enabled as normal)
                continue;
              }
            }
            switch (tmpSchemaEntry.Type) {
              case 'JSON':
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' ' + tmpColumn;
                break;
              case 'JSONProxy':
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' ' + tmpSchemaEntry.StorageColumn;
                break;
              default:
                if (tmpCreateSet != '') {
                  tmpCreateSet += ',';
                }
                tmpCreateSet += ' ' + escapeColumn(tmpColumn, pParameters);
                break;
            }
          }
          return tmpCreateSet;
        };
        var Create = function Create(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpCreateSetList = generateCreateSetList(pParameters);
          var tmpCreateSetValues = generateCreateSetValues(pParameters);
          if (!tmpCreateSetValues) {
            return false;
          }
          return 'INSERT INTO' + tmpTableName + ' (' + tmpCreateSetList + ') VALUES (' + tmpCreateSetValues + ');';
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
        var Read = function Read(pParameters) {
          var tmpFieldList = generateFieldList(pParameters);
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpOrderBy = generateOrderBy(pParameters);
          var tmpLimit = generateLimit(pParameters);
          const tmpOptDistinct = pParameters.distinct ? ' DISTINCT' : '';
          if (pParameters.queryOverride) {
            try {
              var tmpQueryTemplate = _Fable.Utility.template(pParameters.queryOverride);
              return tmpQueryTemplate({
                FieldList: tmpFieldList,
                TableName: tmpTableName,
                Where: tmpWhere,
                OrderBy: tmpOrderBy,
                Limit: tmpLimit,
                Distinct: tmpOptDistinct,
                _Params: pParameters
              });
            } catch (pError) {
              // This pokemon is here to give us a convenient way of not throwing up totally if the query fails.
              console.log('Error with custom Read Query [' + pParameters.queryOverride + ']: ' + pError);
              return false;
            }
          }
          return "SELECT".concat(tmpOptDistinct).concat(tmpFieldList, " FROM").concat(tmpTableName).concat(tmpWhere).concat(tmpOrderBy).concat(tmpLimit, ";");
        };
        var Update = function Update(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpUpdateSetters = generateUpdateSetters(pParameters);
          if (!tmpUpdateSetters) {
            return false;
          }
          return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateSetters + tmpWhere + ';';
        };
        var Delete = function Delete(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          var tmpUpdateDeleteSetters = generateUpdateDeleteSetters(pParameters);
          if (tmpUpdateDeleteSetters) {
            //If it has a deleted bit, update it instead of actually deleting the record
            return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateDeleteSetters + tmpWhere + ';';
          } else {
            return 'DELETE FROM' + tmpTableName + tmpWhere + ';';
          }
        };
        var Undelete = function Undelete(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          let tmpDeleteTrackingState = pParameters.query.disableDeleteTracking;
          pParameters.query.disableDeleteTracking = true;
          var tmpWhere = generateWhere(pParameters);
          var tmpUpdateUndeleteSetters = generateUpdateUndeleteSetters(pParameters);
          pParameters.query.disableDeleteTracking = tmpDeleteTrackingState;
          if (tmpUpdateUndeleteSetters) {
            //If it has a deleted bit, update it instead of actually deleting the record
            return 'UPDATE' + tmpTableName + ' SET' + tmpUpdateUndeleteSetters + tmpWhere + ';';
          } else {
            return 'SELECT NULL;';
          }
        };
        var Count = function Count(pParameters) {
          var tmpTableName = generateTableName(pParameters);
          var tmpWhere = generateWhere(pParameters);
          const tmpFieldList = pParameters.distinct ? generateFieldList(pParameters, true) : '*';

          // here, we ignore the distinct keyword if no fields have been specified and
          if (pParameters.distinct && tmpFieldList.length < 1) {
            console.warn('Distinct requested but no field list or schema are available, so not honoring distinct for count query.');
          }
          const tmpOptDistinct = pParameters.distinct && tmpFieldList.length > 0 ? 'DISTINCT' : '';
          if (pParameters.queryOverride) {
            try {
              var tmpQueryTemplate = _Fable.Utility.template(pParameters.queryOverride);
              return tmpQueryTemplate({
                FieldList: [],
                TableName: tmpTableName,
                Where: tmpWhere,
                OrderBy: '',
                Limit: '',
                Distinct: tmpOptDistinct,
                _Params: pParameters
              });
            } catch (pError) {
              // This pokemon is here to give us a convenient way of not throwing up totally if the query fails.
              console.log('Error with custom Count Query [' + pParameters.queryOverride + ']: ' + pError);
              return false;
            }
          }
          return "SELECT COUNT(".concat(tmpOptDistinct).concat(tmpFieldList || '*', ") AS RowCount FROM").concat(tmpTableName).concat(tmpWhere, ";");
        };
        var tmpDialect = {
          Create: Create,
          Read: Read,
          Update: Update,
          Delete: Delete,
          Undelete: Undelete,
          Count: Count
        };

        /**
        * Dialect Name
        *
        * @property name
        * @type string
        */
        Object.defineProperty(tmpDialect, 'name', {
          get: function get() {
            return 'SQLite';
          },
          enumerable: true
        });
        return tmpDialect;
      };
      module.exports = FoxHoundDialectSQLite;
    }, {}],
    14: [function (require, module, exports) {
      /**
      * FoxHound Solr Dialect
      *
      * Generates Solr query descriptors and Lucene query strings.
      * The query body is a JSON string; the parsed operation object is also
      * stored in query.parameters.solrOperation for direct provider consumption.
      *
      * @license MIT
      *
      * @author Steven Velozo <steven@velozo.com>
      * @class FoxHoundDialectSolr
      */

      var FoxHoundDialectSolr = function FoxHoundDialectSolr(pFable) {
        let _Fable = pFable;

        /**
        * Strip any table-name prefix from a column name.
        *
        * @method stripTablePrefix
        * @param {String} pColumn Column name, possibly table-qualified
        * @return {String} Plain column name
        */
        var stripTablePrefix = function stripTablePrefix(pColumn) {
          if (typeof pColumn !== 'string') {
            return pColumn;
          }
          var tmpColumn = pColumn.replace(/[`"]/g, '');
          if (tmpColumn.indexOf('.') >= 0) {
            var tmpParts = tmpColumn.split('.');
            if (tmpParts[tmpParts.length - 1] === '*') {
              return '*';
            }
            return tmpParts[tmpParts.length - 1];
          }
          return tmpColumn;
        };

        /**
        * Find the schema entry for a given column name.
        *
        * @method findSchemaEntry
        * @param {String} pColumn Column name
        * @param {Array} pSchema Schema array
        * @return {Object} Schema entry or default
        */
        var findSchemaEntry = function findSchemaEntry(pColumn, pSchema) {
          for (var i = 0; i < pSchema.length; i++) {
            if (pColumn == pSchema[i].Column) {
              return pSchema[i];
            }
          }
          return {
            Column: pColumn,
            Type: 'Default'
          };
        };

        /**
        * Escape special Lucene characters in a value.
        *
        * @method escapeValue
        * @param {String} pValue The value to escape
        * @return {String} Escaped value
        */
        var escapeValue = function escapeValue(pValue) {
          if (typeof pValue !== 'string') {
            return pValue;
          }
          // Escape Lucene special chars: + - & | ! ( ) { } [ ] ^ " ~ * ? : \ /
          return pValue.replace(/([+\-&|!(){}\[\]^"~*?:\\/])/g, '\\$1');
        };

        /**
        * Format a value for inclusion in a Solr Lucene query.
        * Strings are double-quoted, numbers stay bare.
        *
        * @method formatSolrValue
        * @param {*} pValue The value to format
        * @return {String} Formatted value string
        */
        var formatSolrValue = function formatSolrValue(pValue) {
          if (typeof pValue === 'number') {
            return String(pValue);
          }
          if (typeof pValue === 'boolean') {
            return pValue ? '1' : '0';
          }
          return '"' + escapeValue(String(pValue)) + '"';
        };

        /**
        * Translate a single FoxHound filter entry into a Solr Lucene clause.
        *
        * @method translateOperator
        * @param {Object} pFilterEntry A FoxHound filter object
        * @return {String} Solr Lucene clause
        */
        var translateOperator = function translateOperator(pFilterEntry) {
          var tmpColumn = stripTablePrefix(pFilterEntry.Column);
          var tmpValue = pFilterEntry.Value;
          switch (pFilterEntry.Operator) {
            case '=':
              return tmpColumn + ':' + formatSolrValue(tmpValue);
            case '!=':
              return '(*:* NOT ' + tmpColumn + ':' + formatSolrValue(tmpValue) + ')';
            case '>':
              return tmpColumn + ':{' + formatSolrValue(tmpValue) + ' TO *}';
            case '>=':
              return tmpColumn + ':[' + formatSolrValue(tmpValue) + ' TO *]';
            case '<':
              return tmpColumn + ':{* TO ' + formatSolrValue(tmpValue) + '}';
            case '<=':
              return tmpColumn + ':[* TO ' + formatSolrValue(tmpValue) + ']';
            case 'LIKE':
              // Convert SQL LIKE pattern to Solr wildcard: % -> *, _ -> ?
              var tmpPattern = String(tmpValue).replace(/%/g, '*').replace(/_/g, '?');
              return tmpColumn + ':' + tmpPattern;
            case 'IN':
              var tmpInValues = Array.isArray(tmpValue) ? tmpValue : [tmpValue];
              var tmpInParts = [];
              for (var i = 0; i < tmpInValues.length; i++) {
                tmpInParts.push(formatSolrValue(tmpInValues[i]));
              }
              return tmpColumn + ':(' + tmpInParts.join(' OR ') + ')';
            case 'NOT IN':
              var tmpNinValues = Array.isArray(tmpValue) ? tmpValue : [tmpValue];
              var tmpNinParts = [];
              for (var j = 0; j < tmpNinValues.length; j++) {
                tmpNinParts.push(formatSolrValue(tmpNinValues[j]));
              }
              return '(*:* NOT ' + tmpColumn + ':(' + tmpNinParts.join(' OR ') + '))';
            case 'IS NULL':
              return '(*:* NOT ' + tmpColumn + ':[* TO *])';
            case 'IS NOT NULL':
              return tmpColumn + ':[* TO *]';
            default:
              return tmpColumn + ':' + formatSolrValue(tmpValue);
          }
        };

        /**
        * Generate the Solr filter query string from the FoxHound filter array.
        * Uses a stack-based approach for parenthetical groups.
        *
        * @method generateFilter
        * @param {Object} pParameters Query Parameters
        * @return {String} Solr filter query string or empty string
        */
        var generateFilter = function generateFilter(pParameters) {
          var tmpFilter = Array.isArray(pParameters.filter) ? pParameters.filter.slice() : [];

          // Auto-add Deleted filter if applicable
          if (!pParameters.query.disableDeleteTracking) {
            var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
            for (var i = 0; i < tmpSchema.length; i++) {
              if (tmpSchema[i].Type === 'Deleted') {
                var tmpHasDeletedParam = false;
                for (var x = 0; x < tmpFilter.length; x++) {
                  if (stripTablePrefix(tmpFilter[x].Column) === tmpSchema[i].Column) {
                    tmpHasDeletedParam = true;
                    break;
                  }
                }
                if (!tmpHasDeletedParam) {
                  tmpFilter.push({
                    Column: tmpSchema[i].Column,
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
          if (tmpFilter.length < 1) {
            return '';
          }

          // Stack-based processing for parenthetical groups
          var tmpStack = [[]];
          for (var i = 0; i < tmpFilter.length; i++) {
            var tmpEntry = tmpFilter[i];
            if (tmpEntry.Operator === '(') {
              tmpStack.push([]);
            } else if (tmpEntry.Operator === ')') {
              var tmpGroupConditions = tmpStack.pop();
              var tmpHasOR = false;
              for (var g = 0; g < tmpGroupConditions.length; g++) {
                if (tmpGroupConditions[g].connector === 'OR') {
                  tmpHasOR = true;
                  break;
                }
              }
              var tmpGroupText = '';
              for (var g2 = 0; g2 < tmpGroupConditions.length; g2++) {
                if (g2 > 0) {
                  tmpGroupText += tmpHasOR ? ' OR ' : ' AND ';
                }
                tmpGroupText += tmpGroupConditions[g2].text;
              }
              tmpStack[tmpStack.length - 1].push({
                text: '(' + tmpGroupText + ')',
                connector: tmpEntry.Connector || 'AND'
              });
            } else {
              tmpStack[tmpStack.length - 1].push({
                text: translateOperator(tmpEntry),
                connector: tmpEntry.Connector || 'AND'
              });
            }
          }

          // Collapse root level
          var tmpRootConditions = tmpStack[0];
          if (tmpRootConditions.length === 0) {
            return '';
          }
          var tmpFilterText = '';
          for (var r = 0; r < tmpRootConditions.length; r++) {
            if (r > 0) {
              tmpFilterText += ' ' + tmpRootConditions[r].connector + ' ';
            }
            tmpFilterText += tmpRootConditions[r].text;
          }
          return tmpFilterText;
        };

        /**
        * Generate the field list for a Solr query from dataElements.
        *
        * @method generateFieldList
        * @param {Object} pParameters Query Parameters
        * @return {String} Comma-separated field list or '*' for all fields
        */
        var generateFieldList = function generateFieldList(pParameters) {
          var tmpDataElements = pParameters.dataElements;
          if (!Array.isArray(tmpDataElements) || tmpDataElements.length < 1) {
            return '*';
          }
          var tmpFields = [];
          for (var i = 0; i < tmpDataElements.length; i++) {
            var tmpField = tmpDataElements[i];
            if (Array.isArray(tmpField)) {
              tmpField = tmpField[0];
            }
            tmpField = stripTablePrefix(tmpField);
            if (tmpField !== '*' && tmpFields.indexOf(tmpField) < 0) {
              tmpFields.push(tmpField);
            }
          }
          if (tmpFields.length === 0) {
            return '*';
          }
          return tmpFields.join(',');
        };

        /**
        * Generate Solr sort string from sort array.
        *
        * @method generateSort
        * @param {Object} pParameters Query Parameters
        * @return {String} Sort string (e.g. "Name asc, Age desc") or empty string
        */
        var generateSort = function generateSort(pParameters) {
          var tmpSort = pParameters.sort;
          if (!Array.isArray(tmpSort) || tmpSort.length < 1) {
            return '';
          }
          var tmpParts = [];
          for (var i = 0; i < tmpSort.length; i++) {
            var tmpColumn = stripTablePrefix(tmpSort[i].Column);
            var tmpDir = tmpSort[i].Direction === 'Descending' ? 'desc' : 'asc';
            tmpParts.push(tmpColumn + ' ' + tmpDir);
          }
          return tmpParts.join(', ');
        };

        /**
        * Generate the document for an add operation.
        * Walks the record through the schema to handle special column types.
        *
        * @method generateCreateDocument
        * @param {Object} pParameters Query Parameters
        * @return {Object|false} Document object or false if no record
        */
        var generateCreateDocument = function generateCreateDocument(pParameters) {
          var tmpRecords = pParameters.query.records;
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpDocument = {};
          for (var tmpColumn in tmpRecords[0]) {
            var tmpSchemaEntry = findSchemaEntry(tmpColumn, tmpSchema);
            if (!pParameters.query.disableDeleteTracking) {
              if (tmpSchemaEntry.Type === 'DeleteDate' || tmpSchemaEntry.Type === 'DeleteIDUser') {
                continue;
              }
            }
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
                if (pParameters.query.disableAutoIdentity) {
                  tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                } else {
                  tmpDocument[tmpColumn] = '$$AUTOINCREMENT';
                }
                break;
              case 'AutoGUID':
                if (pParameters.query.disableAutoIdentity) {
                  tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                } else if (tmpRecords[0][tmpColumn] && tmpRecords[0][tmpColumn].length >= 5 && tmpRecords[0][tmpColumn] !== '0x0000000000000000') {
                  tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                } else {
                  tmpDocument[tmpColumn] = pParameters.query.UUID;
                }
                break;
              case 'UpdateDate':
              case 'CreateDate':
                if (pParameters.query.disableAutoDateStamp) {
                  tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                } else {
                  tmpDocument[tmpColumn] = '$$NOW';
                }
                break;
              case 'DeleteIDUser':
              case 'UpdateIDUser':
              case 'CreateIDUser':
                if (pParameters.query.disableAutoUserStamp) {
                  tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                } else {
                  tmpDocument[tmpColumn] = pParameters.query.IDUser;
                }
                break;
              case 'Deleted':
                tmpDocument[tmpColumn] = 0;
                break;
              default:
                tmpDocument[tmpColumn] = tmpRecords[0][tmpColumn];
                break;
            }
          }
          if (Object.keys(tmpDocument).length === 0) {
            return false;
          }
          return tmpDocument;
        };

        /**
        * Generate the atomic update document for an update operation.
        * Uses Solr's atomic update syntax: { "field": { "set": value } }
        *
        * @method generateUpdateDocument
        * @param {Object} pParameters Query Parameters
        * @return {Object|false} Atomic update document or false
        */
        var generateUpdateDocument = function generateUpdateDocument(pParameters) {
          var tmpRecords = pParameters.query.records;
          if (!Array.isArray(tmpRecords) || tmpRecords.length < 1) {
            return false;
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpUpdateDoc = {};
          for (var tmpColumn in tmpRecords[0]) {
            var tmpSchemaEntry = findSchemaEntry(tmpColumn, tmpSchema);
            if (pParameters.query.disableAutoUserStamp && tmpSchemaEntry.Type === 'UpdateIDUser') {
              continue;
            }
            switch (tmpSchemaEntry.Type) {
              case 'AutoIdentity':
              case 'CreateDate':
              case 'CreateIDUser':
              case 'DeleteDate':
              case 'DeleteIDUser':
                continue;
            }
            switch (tmpSchemaEntry.Type) {
              case 'UpdateDate':
                if (pParameters.query.disableAutoDateStamp) {
                  tmpUpdateDoc[tmpColumn] = {
                    'set': tmpRecords[0][tmpColumn]
                  };
                } else {
                  tmpUpdateDoc[tmpColumn] = {
                    'set': '$$NOW'
                  };
                }
                break;
              case 'UpdateIDUser':
                tmpUpdateDoc[tmpColumn] = {
                  'set': pParameters.query.IDUser
                };
                break;
              default:
                tmpUpdateDoc[tmpColumn] = {
                  'set': tmpRecords[0][tmpColumn]
                };
                break;
            }
          }
          if (Object.keys(tmpUpdateDoc).length === 0) {
            return false;
          }
          return tmpUpdateDoc;
        };

        /**
        * Generate the soft-delete atomic update fields.
        *
        * @method generateDeleteSetters
        * @param {Object} pParameters Query Parameters
        * @return {Object|false} Delete setters or false
        */
        var generateDeleteSetters = function generateDeleteSetters(pParameters) {
          if (pParameters.query.disableDeleteTracking) {
            return false;
          }
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpHasDeletedField = false;
          var tmpSetters = {};
          for (var i = 0; i < tmpSchema.length; i++) {
            var tmpSchemaEntry = tmpSchema[i];
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpSetters[tmpSchemaEntry.Column] = {
                  'set': 1
                };
                tmpHasDeletedField = true;
                break;
              case 'DeleteDate':
                tmpSetters[tmpSchemaEntry.Column] = {
                  'set': '$$NOW'
                };
                break;
              case 'UpdateDate':
                tmpSetters[tmpSchemaEntry.Column] = {
                  'set': '$$NOW'
                };
                break;
              case 'DeleteIDUser':
                tmpSetters[tmpSchemaEntry.Column] = {
                  'set': pParameters.query.IDUser
                };
                break;
              default:
                continue;
            }
          }
          if (!tmpHasDeletedField || Object.keys(tmpSetters).length === 0) {
            return false;
          }
          return tmpSetters;
        };

        /**
        * Generate the undelete atomic update fields.
        *
        * @method generateUndeleteSetters
        * @param {Object} pParameters Query Parameters
        * @return {Object|false} Undelete setters or false
        */
        var generateUndeleteSetters = function generateUndeleteSetters(pParameters) {
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          var tmpHasDeletedField = false;
          var tmpSetters = {};
          for (var i = 0; i < tmpSchema.length; i++) {
            var tmpSchemaEntry = tmpSchema[i];
            switch (tmpSchemaEntry.Type) {
              case 'Deleted':
                tmpSetters[tmpSchemaEntry.Column] = {
                  'set': 0
                };
                tmpHasDeletedField = true;
                break;
              case 'UpdateDate':
                tmpSetters[tmpSchemaEntry.Column] = {
                  'set': '$$NOW'
                };
                break;
              case 'UpdateIDUser':
                tmpSetters[tmpSchemaEntry.Column] = {
                  'set': pParameters.query.IDUser
                };
                break;
              default:
                continue;
            }
          }
          if (!tmpHasDeletedField || Object.keys(tmpSetters).length === 0) {
            return false;
          }
          return tmpSetters;
        };

        /**
        * Create a new record
        *
        * @method Create
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor or false
        */
        var Create = function Create(pParameters) {
          var tmpDocument = generateCreateDocument(pParameters);
          if (!tmpDocument) {
            return false;
          }

          // Determine if we need a counter scope for auto-increment
          var tmpCounterScope = false;
          var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
          for (var i = 0; i < tmpSchema.length; i++) {
            if (tmpSchema[i].Type === 'AutoIdentity' && !pParameters.query.disableAutoIdentity) {
              tmpCounterScope = pParameters.scope + '.' + tmpSchema[i].Column;
              break;
            }
          }
          var tmpResult = {
            collection: pParameters.scope,
            operation: 'add',
            document: tmpDocument
          };
          if (tmpCounterScope) {
            tmpResult.counterScope = tmpCounterScope;
          }
          pParameters.query.parameters.solrOperation = tmpResult;
          return JSON.stringify(tmpResult);
        };

        /**
        * Read one or many records
        *
        * @method Read
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor
        */
        var Read = function Read(pParameters) {
          if (pParameters.join && Array.isArray(pParameters.join) && pParameters.join.length > 0) {
            _Fable.log.warn('Solr dialect does not support JOINs; join parameter will be ignored.');
          }
          var tmpFilterQuery = generateFilter(pParameters);
          var tmpFieldList = generateFieldList(pParameters);
          var tmpSort = generateSort(pParameters);
          var tmpResult = {
            collection: pParameters.scope,
            operation: 'search',
            query: '*:*'
          };
          if (tmpFilterQuery) {
            tmpResult.filterQuery = tmpFilterQuery;
          }
          if (tmpFieldList !== '*') {
            tmpResult.fields = tmpFieldList;
          }
          if (tmpSort) {
            tmpResult.sort = tmpSort;
          }
          if (pParameters.cap) {
            tmpResult.rows = pParameters.cap;
          }
          if (pParameters.begin !== false && pParameters.begin > 0) {
            tmpResult.start = pParameters.begin;
          }
          if (pParameters.distinct) {
            tmpResult.distinct = true;
          }
          pParameters.query.parameters.solrOperation = tmpResult;
          return JSON.stringify(tmpResult);
        };

        /**
        * Update one or many records
        *
        * @method Update
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor or false
        */
        var Update = function Update(pParameters) {
          var tmpFilterQuery = generateFilter(pParameters);
          var tmpUpdateDoc = generateUpdateDocument(pParameters);
          if (!tmpUpdateDoc) {
            return false;
          }
          var tmpResult = {
            collection: pParameters.scope,
            operation: 'atomicUpdate',
            filterQuery: tmpFilterQuery || '*:*',
            update: tmpUpdateDoc
          };
          pParameters.query.parameters.solrOperation = tmpResult;
          return JSON.stringify(tmpResult);
        };

        /**
        * Delete one or many records (soft or hard depending on schema)
        *
        * @method Delete
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor
        */
        var Delete = function Delete(pParameters) {
          var tmpDeleteSetters = generateDeleteSetters(pParameters);
          var tmpFilterQuery = generateFilter(pParameters);
          if (tmpDeleteSetters) {
            // Soft delete via atomic update
            var tmpResult = {
              collection: pParameters.scope,
              operation: 'atomicUpdate',
              filterQuery: tmpFilterQuery || '*:*',
              update: tmpDeleteSetters
            };
            pParameters.query.parameters.solrOperation = tmpResult;
            return JSON.stringify(tmpResult);
          } else {
            // Hard delete
            var tmpHardResult = {
              collection: pParameters.scope,
              operation: 'deleteByQuery',
              filterQuery: tmpFilterQuery || '*:*'
            };
            pParameters.query.parameters.solrOperation = tmpHardResult;
            return JSON.stringify(tmpHardResult);
          }
        };

        /**
        * Undelete (restore) a soft-deleted record
        *
        * @method Undelete
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor
        */
        var Undelete = function Undelete(pParameters) {
          var tmpUndeleteSetters = generateUndeleteSetters(pParameters);

          // Temporarily disable delete tracking for filter generation
          var tmpDeleteTrackingState = pParameters.query.disableDeleteTracking;
          pParameters.query.disableDeleteTracking = true;
          var tmpFilterQuery = generateFilter(pParameters);
          pParameters.query.disableDeleteTracking = tmpDeleteTrackingState;
          if (tmpUndeleteSetters) {
            var tmpResult = {
              collection: pParameters.scope,
              operation: 'atomicUpdate',
              filterQuery: tmpFilterQuery || '*:*',
              update: tmpUndeleteSetters
            };
            pParameters.query.parameters.solrOperation = tmpResult;
            return JSON.stringify(tmpResult);
          } else {
            var tmpNoopResult = {
              collection: pParameters.scope,
              operation: 'noop'
            };
            pParameters.query.parameters.solrOperation = tmpNoopResult;
            return JSON.stringify(tmpNoopResult);
          }
        };

        /**
        * Count records
        *
        * @method Count
        * @param {Object} pParameters Query parameters
        * @return {String} JSON operation descriptor
        */
        var Count = function Count(pParameters) {
          var tmpFilterQuery = generateFilter(pParameters);
          var tmpResult = {
            collection: pParameters.scope,
            operation: 'search',
            query: '*:*',
            rows: 0,
            isCount: true
          };
          if (tmpFilterQuery) {
            tmpResult.filterQuery = tmpFilterQuery;
          }
          if (pParameters.distinct) {
            tmpResult.distinct = true;
            var tmpDataElements = pParameters.dataElements;
            if (Array.isArray(tmpDataElements) && tmpDataElements.length > 0) {
              var tmpFields = [];
              for (var i = 0; i < tmpDataElements.length; i++) {
                var tmpField = Array.isArray(tmpDataElements[i]) ? tmpDataElements[i][0] : tmpDataElements[i];
                tmpField = stripTablePrefix(tmpField);
                if (tmpField !== '*') {
                  tmpFields.push(tmpField);
                }
              }
              if (tmpFields.length > 0) {
                tmpResult.distinctFields = tmpFields;
              }
            } else {
              var tmpSchema = Array.isArray(pParameters.query.schema) ? pParameters.query.schema : [];
              for (var j = 0; j < tmpSchema.length; j++) {
                if (tmpSchema[j].Type === 'AutoIdentity') {
                  tmpResult.distinctFields = [tmpSchema[j].Column];
                  break;
                }
              }
            }
          }
          pParameters.query.parameters.solrOperation = tmpResult;
          return JSON.stringify(tmpResult);
        };
        var tmpDialect = {
          Create: Create,
          Read: Read,
          Update: Update,
          Delete: Delete,
          Undelete: Undelete,
          Count: Count
        };

        /**
        * Dialect Name
        *
        * @property name
        * @type string
        */
        Object.defineProperty(tmpDialect, 'name', {
          get: function get() {
            return 'Solr';
          },
          enumerable: true
        });
        return tmpDialect;
      };
      module.exports = FoxHoundDialectSolr;
    }, {}]
  }, {}, [1])(1);
});
//# sourceMappingURL=foxhound.js.map
