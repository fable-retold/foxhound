# Quickstart

Get up and running with FoxHound in under five minutes.

## Installation

```bash
npm install foxhound fable
```

FoxHound requires [Fable](https://fable-retold.github.io/fable/) as a peer dependency for logging, UUID generation, and utility functions.

## Your First Query

```javascript
var libFable = require('fable');
var libFoxHound = require('foxhound');

// Create a Fable instance (provides logging, UUIDs, and utilities)
var _Fable = new libFable({Product: 'MyApp'});

// Create a new FoxHound query
var tmpQuery = libFoxHound.new(_Fable);

// Build a simple SELECT
tmpQuery
	.setScope('Books')
	.setDialect('MySQL')
	.buildReadQuery();

console.log(tmpQuery.query.body);
// => SELECT `Books`.* FROM `Books`;
```

## Selecting Specific Columns

```javascript
var tmpQuery = libFoxHound.new(_Fable)
	.setDialect('MySQL')
	.setScope('Books')
	.setDataElements(['Title', 'Author', 'PublishedYear'])
	.buildReadQuery();

console.log(tmpQuery.query.body);
// => SELECT `Title`, `Author`, `PublishedYear` FROM `Books`;
```

## Adding Filters

```javascript
var tmpQuery = libFoxHound.new(_Fable)
	.setDialect('MySQL')
	.setScope('Books')
	.setDataElements(['Title', 'Author'])
	.addFilter('Genre', 'Science Fiction')
	.addFilter('PublishedYear', 2000, '>')
	.buildReadQuery();

console.log(tmpQuery.query.body);
// => SELECT `Title`, `Author` FROM `Books`
//    WHERE `Books`.`Genre` = :Genre_w0
//    AND `Books`.`PublishedYear` > :PublishedYear_w1;

console.log(tmpQuery.query.parameters);
// => { Genre_w0: 'Science Fiction', PublishedYear_w1: 2000 }
```

## Sorting and Pagination

```javascript
var tmpQuery = libFoxHound.new(_Fable)
	.setDialect('MySQL')
	.setScope('Books')
	.addSort({Column: 'PublishedYear', Direction: 'Descending'})
	.setCap(25)
	.setBegin(0)
	.buildReadQuery();

console.log(tmpQuery.query.body);
// => SELECT `Books`.* FROM `Books`
//    ORDER BY PublishedYear DESC LIMIT 0, 25;
```

## Creating a Record

```javascript
var tmpQuery = libFoxHound.new(_Fable)
	.setDialect('MySQL')
	.setScope('Books')
	.addRecord({Title: 'Dune', Author: 'Frank Herbert', PublishedYear: 1965})
	.buildCreateQuery();

console.log(tmpQuery.query.body);
// => INSERT INTO `Books` ( Title, Author, PublishedYear)
//    VALUES ( :Title_0, :Author_1, :PublishedYear_2);

console.log(tmpQuery.query.parameters);
// => { Title_0: 'Dune', Author_1: 'Frank Herbert', PublishedYear_2: 1965 }
```

## Updating a Record

```javascript
var tmpQuery = libFoxHound.new(_Fable)
	.setDialect('MySQL')
	.setScope('Books')
	.addFilter('IDBook', 42)
	.addRecord({Title: 'Dune Messiah', PublishedYear: 1969})
	.buildUpdateQuery();

console.log(tmpQuery.query.body);
// => UPDATE `Books` SET Title = :Title_0, PublishedYear = :PublishedYear_1
//    WHERE IDBook = :IDBook_w0;
```

## Deleting a Record

```javascript
var tmpQuery = libFoxHound.new(_Fable)
	.setDialect('MySQL')
	.setScope('Books')
	.addFilter('IDBook', 42)
	.buildDeleteQuery();

console.log(tmpQuery.query.body);
// => DELETE FROM `Books` WHERE IDBook = :IDBook_w0;
```

## Switching Dialects

The same query configuration works across all dialects:

```javascript
var tmpQuery = libFoxHound.new(_Fable)
	.setScope('Books')
	.setDataElements(['Title', 'Author'])
	.addFilter('Genre', 'Fantasy')
	.setCap(10);

// MySQL
tmpQuery.setDialect('MySQL').buildReadQuery();
console.log(tmpQuery.query.body);
// => SELECT `Title`, `Author` FROM `Books`
//    WHERE `Books`.`Genre` = :Genre_w0 LIMIT 10;

// PostgreSQL
tmpQuery.setDialect('PostgreSQL').buildReadQuery();
console.log(tmpQuery.query.body);
// => SELECT "Title", "Author" FROM "Books"
//    WHERE "Genre" = :Genre_w0 LIMIT 10;

// MSSQL
tmpQuery.setDialect('MSSQL').buildReadQuery();
console.log(tmpQuery.query.body);
// => SELECT [Title], [Author] FROM [Books]
//    WHERE Genre = @Genre_w0 OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;
```

## Using with a Schema

Attaching a schema enables automatic management of identity, timestamp, and soft-delete columns:

```javascript
var tmpQuery = libFoxHound.new(_Fable)
	.setDialect('MySQL')
	.setScope('Books')
	.addRecord({IDBook: null, Title: 'Neuromancer', Author: 'William Gibson'});

tmpQuery.query.schema = [
	{Column: 'IDBook', Type: 'AutoIdentity'},
	{Column: 'Title', Type: 'String'},
	{Column: 'Author', Type: 'String'},
	{Column: 'CreateDate', Type: 'CreateDate'},
	{Column: 'CreatingIDUser', Type: 'CreateIDUser'},
	{Column: 'UpdateDate', Type: 'UpdateDate'},
	{Column: 'UpdatingIDUser', Type: 'UpdateIDUser'},
	{Column: 'Deleted', Type: 'Deleted'},
	{Column: 'DeleteDate', Type: 'DeleteDate'},
	{Column: 'DeletingIDUser', Type: 'DeleteIDUser'}
];
tmpQuery.query.IDUser = 5;

tmpQuery.buildCreateQuery();

console.log(tmpQuery.query.body);
// => INSERT INTO `Books` ( IDBook, Title, Author, CreateDate, ...)
//    VALUES ( NULL, :Title_1, :Author_2, NOW(3), ...);
```

## Next Steps

- [Architecture](architecture.md) -- understand FoxHound's internal design
- [Filters](filters.md) -- learn about filter operators and grouping
- [Schema Integration](schema.md) -- use schemas for automatic column management
- [Dialects](dialects/README.md) -- explore dialect-specific features
- [API Reference](api/README.md) -- complete function reference
