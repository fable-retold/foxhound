# Query Building Overview

FoxHound builds queries through a two-phase process: **configure** then **build**.

## The Query Lifecycle

<!-- bespoke diagram: edit diagrams/the-query-lifecycle.mmd or .hints.json, then: npx pict-renderer-graph build modules/meadow/foxhound/docs/query -->
![The Query Lifecycle](diagrams/the-query-lifecycle.svg)

1. **Configure** -- set the scope, fields, filters, sorts, joins, pagination, records, and dialect
2. **Build** -- call one of the `build*Query()` methods to generate the SQL
3. **Access** -- read `query.body` for the SQL string and `query.parameters` for bound values

## Creating a Query Instance

```javascript
var libFoxHound = require('foxhound');
var tmpQuery = libFoxHound.new(_Fable);
```

Or, when working through Meadow, the DAL provides a pre-configured query:

```javascript
var tmpQuery = myMeadow.query;
```

## Setting the Scope

The scope is the primary table (or collection) the query targets:

```javascript
tmpQuery.setScope('Books');
```

## Setting the Dialect

Before building, select which SQL dialect to produce:

```javascript
tmpQuery.setDialect('MySQL');   // MySQL
tmpQuery.setDialect('MSSQL');   // Microsoft SQL Server
tmpQuery.setDialect('SQLite');  // SQLite
tmpQuery.setDialect('ALASQL');  // ALASQL (in-memory)
tmpQuery.setDialect('English'); // Human-readable (default)
```

If no dialect is set, FoxHound defaults to `English`.

## Build Methods

| Method | Operation | SQL Pattern |
|--------|-----------|-------------|
| `buildCreateQuery()` | Insert a record | `INSERT INTO ... VALUES (...)` |
| `buildReadQuery()` | Select records | `SELECT ... FROM ... WHERE ...` |
| `buildUpdateQuery()` | Modify a record | `UPDATE ... SET ... WHERE ...` |
| `buildDeleteQuery()` | Soft- or hard-delete | `UPDATE ... SET Deleted=1` or `DELETE FROM ...` |
| `buildUndeleteQuery()` | Restore soft-deleted | `UPDATE ... SET Deleted=0` |
| `buildCountQuery()` | Count matching rows | `SELECT COUNT(*) AS RowCount FROM ...` |

Every build method returns `this` for chaining.

## Reading the Output

After building, the generated query is available on the `query` property:

```javascript
tmpQuery.setScope('Books')
    .setDialect('MySQL')
    .buildReadQuery();

console.log(tmpQuery.query.body);
// => SELECT `Books`.* FROM `Books`;

console.log(tmpQuery.query.parameters);
// => {} (no filters, so no bound parameters)
```

## Resetting & Cloning

After a query is built, you can reset the parameters for reuse or clone the query to create a variant:

```javascript
// Reset to default parameters
tmpQuery.resetParameters();

// Clone -- copies scope, begin, cap, schema, filters, sorts, and dataElements
var tmpClone = tmpQuery.clone();
```

## Full Example

```javascript
var libFable = require('fable');
var libFoxHound = require('foxhound');

var _Fable = new libFable({});
var tmpQuery = libFoxHound.new(_Fable);

tmpQuery
    .setScope('Books')
    .setDataElements(['Title', 'Author', 'PublishedYear'])
    .addFilter('Genre', 'Science Fiction')
    .addSort({Column: 'PublishedYear', Direction: 'Descending'})
    .setCap(25)
    .setDialect('MySQL')
    .buildReadQuery();

console.log(tmpQuery.query.body);
// => SELECT `Title`, `Author`, `PublishedYear` FROM `Books`
//    WHERE `Books`.`Genre` = :Genre_w0 ORDER BY PublishedYear DESC LIMIT 25;

console.log(tmpQuery.query.parameters);
// => { Genre_w0: 'Science Fiction' }
```
