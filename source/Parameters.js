/**
* Query Parameters Object
*
* @class FoxHoundQueryParameters
* @constructor
*/
var FoxHoundQueryParameters = (
{
		scope: false,        // STR: The scope of the data
								// TSQL: the "Table" or "View"
								// MongoDB: the "Collection"

		dataElements: false, // ARR of STR: The data elements to return
								// TSQL: the "Columns"
								// MongoDB: the "Fields"

		begin: false,        // INT: Record index to start at
								// TSQL: n in LIMIT 1,n
								// MongoDB: n in Skip(n)

		cap: false,          // INT: Maximum number of records to return
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
		filter: false,       // ARR of OBJ: Data filter expression list {Column:'Name', Operator:'EQ', Value:'John', Connector:'And', Parameter:'Name'}
								// TSQL: the WHERE clause
								// MongoDB: a find() expression

		sort: false,         // ARR of OBJ: The sort order    {Column:'Birthday', Direction:'Ascending'}
								// TSQL: ORDER BY
								// MongoDB: sort()

		join: false,         // ARR of OBJ: The join tables    {Type:'INNER JOIN', Table:'test', From: 'Test.ID', To: 'Scope.IDItem' }
								// TSQL: JOIN

		// Force a specific query to run regardless of above ... this is used to override the query generator.
		queryOverride: false,

		// Where the generated query goes
		query: false,
		/*
			{
				body: false,
				schema: false,   // The schema to intersect with our records
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

		queryBranches: false,
		/*
			A set of alternative join/filter paths to the same records, UNIONed together.

			[
				{ join: [ {Type,Table,From,To}, ... ], filter: [ ...filter entries... ] },
				{ join: [ ... ],                       filter: [ ... ] }
			]

			Each branch inherits the query's scope, data elements, filters and sort, and adds its own
			joins and filters on top. The dialect emits one derived table per branch UNIONed together,
			pushing the sort and an (begin+cap) limit into each branch so each can be satisfied from
			its own index rather than scanning to satisfy the outer ORDER BY.

			Used when a record is reachable for more than one independent reason and a single flat
			query would have to express that as an OR, which prevents the optimizer from driving
			the query off any one of them.
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
});

module.exports = FoxHoundQueryParameters;
