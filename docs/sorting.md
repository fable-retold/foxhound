# Sorting

FoxHound generates `ORDER BY` clauses from sort expressions.  Sorting applies to Read queries.

## Adding a Sort

The simplest way to add a sort is with `addSort()`:

```javascript
// Sort ascending by column name (default direction)
tmpQuery.addSort('PublishedYear');

// ORDER BY PublishedYear
```

For descending order, pass a sort object:

```javascript
tmpQuery.addSort({Column: 'PublishedYear', Direction: 'Descending'});

// ORDER BY PublishedYear DESC
```

## Multiple Sort Columns

Chain multiple `addSort()` calls to sort by several columns:

```javascript
tmpQuery
    .addSort({Column: 'Genre', Direction: 'Ascending'})
    .addSort({Column: 'PublishedYear', Direction: 'Descending'});

// ORDER BY Genre, PublishedYear DESC
```

Columns without an explicit `Direction` (or with `Direction: 'Ascending'`) sort in ascending order -- the SQL default.

## Setting Sorts Directly

For full control, use `setSort()` to replace the entire sort array:

```javascript
tmpQuery.setSort([
    {Column: 'Genre', Direction: 'Ascending'},
    {Column: 'Title', Direction: 'Ascending'}
]);
```

You can also pass a single string (defaults to ascending):

```javascript
tmpQuery.setSort('Title');
// ORDER BY Title
```

Or a single sort object:

```javascript
tmpQuery.setSort({Column: 'Title', Direction: 'Descending'});
// ORDER BY Title DESC
```

## Sort Object Structure

| Property | Type | Values | Description |
|----------|------|--------|-------------|
| `Column` | String | Any column name | Column to sort by |
| `Direction` | String | `'Ascending'` or `'Descending'` | Sort direction |

## Dialect Differences

The `ORDER BY` clause syntax is consistent across all SQL dialects.  The main difference is in identifier quoting:

- **MySQL** -- `ORDER BY PublishedYear DESC`
- **MSSQL** -- `ORDER BY [PublishedYear] DESC`
- **SQLite/ALASQL** -- `ORDER BY \`PublishedYear\` DESC`

## Interaction with Pagination

A capped read has its identity column appended to the sort as a final tiebreaker, so that paging returns each row exactly once.  Your sort still leads — the identity column only orders rows your sort considers equal.  See [Stable Pagination](pagination.md#stable-pagination) for the mechanism, the cases where nothing is appended, and the `disableStableSort` opt-out.
