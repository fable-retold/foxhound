# FoxHound

> A fluent query generation DSL for Node.js and the browser

FoxHound is a fluent query generation DSL for Node.js and the browser.  It produces dialect-specific SQL (or other query formats) from a single chainable API, keeping your application code database-agnostic while generating safe, parameterized queries.

## Features

- **Chainable API** -- every configuration method returns the query object, so you can compose queries in a single expression
- **Multiple Dialects** -- generate SQL for MySQL, PostgreSQL, Microsoft SQL Server, SQLite, ALASQL, or plain English, all from the same code
- **Parameterized Queries** -- user-supplied values are always bound as named parameters, preventing SQL injection
- **Schema-Aware** -- when a schema is provided, FoxHound automatically manages identity columns, timestamps, user stamps, and soft-delete tracking
- **Full CRUD + Count** -- build CREATE, READ, UPDATE, DELETE, UNDELETE, and COUNT queries
- **Query Overrides** -- supply an underscore-style template to customize query generation while still benefiting from automatic parameter binding
- **Filtering & Sorting** -- rich filter expressions with multiple operators, logical grouping, and multi-column sorting
- **Joins & Pagination** -- INNER, LEFT, and custom joins plus dialect-aware LIMIT/OFFSET pagination
- **Fable Integration** -- operates as a Fable service, inheriting configuration, logging, and UUID generation

## Quick Start

```
$ npm install foxhound
```

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

## How It Works

1. **Create a Query** -- instantiate via `foxhound.new(fable)` or through a Fable service
2. **Configure** -- chain methods to set scope (table), fields, filters, sorts, joins, and pagination
3. **Set a Dialect** -- call `.setDialect('MySQL')` (or PostgreSQL, MSSQL, SQLite, ALASQL, English)
4. **Build** -- call a build method such as `.buildReadQuery()` to generate the SQL
5. **Execute** -- read the generated SQL from `.query.body` and bound parameters from `.query.parameters`

## Documentation

- [Quickstart](quickstart.md) -- get up and running in five minutes
- [Architecture](architecture.md) -- understand FoxHound's internal design
- [Filters](filters.md) -- filter operators and logical grouping
- [Sorting](sorting.md) -- ORDER BY clause generation
- [Joins](joins.md) -- multi-table queries
- [Pagination](pagination.md) -- LIMIT/OFFSET across dialects
- [Schema Integration](schema.md) -- automatic column management
- [Dialects](dialects/README.md) -- dialect-specific features and differences
- [API Reference](api/README.md) -- complete function reference with code examples
- [Query Overrides](query-overrides.md) -- custom SQL templates

## Related Packages

| Package | Purpose |
|---------|---------|
| [fable](https://fable-retold.github.io/fable/) | Core service framework (required dependency) |
| [meadow](https://fable-retold.github.io/meadow/) | Data access layer that uses FoxHound for query generation |
| [stricture](https://fable-retold.github.io/stricture/) | Schema definition tool that produces FoxHound-compatible schema arrays |
| [meadow-endpoints](https://fable-retold.github.io/meadow-endpoints/) | REST endpoint generator built on Meadow + FoxHound |

## Testing

```
$ npm test
$ npm run coverage
```
