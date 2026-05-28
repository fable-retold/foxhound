/**
* Unit tests for FoxHound Oracle Dialect
*
* @license     MIT
*
* @author      Steven Velozo <steven@velozo.com>
*/

var Chai = require('chai');
var Expect = Chai.expect;

var libFable = require('fable');
const _Fable = new libFable({Product:'FoxhoundTestsOracle'});
var libFoxHound = require('../source/FoxHound.js');

var _AnimalSchema = (
[
	{ Column: "IDAnimal",        Type:"AutoIdentity" },
	{ Column: "GUIDAnimal",      Type:"AutoGUID" },
	{ Column: "CreateDate",      Type:"CreateDate" },
	{ Column: "CreatingIDUser",  Type:"CreateIDUser" },
	{ Column: "UpdateDate",      Type:"UpdateDate" },
	{ Column: "UpdatingIDUser",  Type:"UpdateIDUser" },
	{ Column: "Deleted",         Type:"Deleted" },
	{ Column: "DeletingIDUser",  Type:"DeleteIDUser" },
	{ Column: "DeleteDate",      Type:"DeleteDate" },
	{ Column: "Name",            Type:"String" },
	{ Column: "Age",             Type:"Integer" }
]);

var _AnimalSchemaWithoutDeleted = (
[
	{ Column: "IDAnimal",        Type:"AutoIdentity" },
	{ Column: "GUIDAnimal",      Type:"AutoGUID" },
	{ Column: "CreateDate",      Type:"CreateDate" },
	{ Column: "CreatingIDUser",  Type:"CreateIDUser" },
	{ Column: "UpdateDate",      Type:"UpdateDate" },
	{ Column: "UpdatingIDUser",  Type:"UpdateIDUser" }
]);

suite
(
	'FoxHound-Dialect-Oracle',
	function()
	{
		suite
		(
			'Object Sanity',
			function()
			{
				test
				(
					'initialize should build a happy little object',
					function()
					{
						var testFoxHound = libFoxHound.new(_Fable).setDialect('Oracle');
						Expect(testFoxHound.dialect.name)
							.to.equal('Oracle');
						Expect(testFoxHound)
							.to.be.an('object', 'FoxHound with Oracle should initialize as an object directly from the require statement.');
					}
				);
			}
		);

		suite
		(
			'Create Query Generation',
			function()
			{
				test
				(
					'Create Query without schema parameterizes every column and has no RETURNING',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('Oracle')
							.setScope('Animal')
							.addRecord({IDAnimal:null, Name:'Foo Foo', Age:15});
						tmpQuery.buildCreateQuery();
						Expect(tmpQuery.query.body)
							.to.equal("INSERT INTO Animal ( IDAnimal, Name, Age) VALUES ( :IDAnimal_0, :Name_1, :Age_2)");
					}
				);
				test
				(
					'Create Query with schema skips AutoIdentity and appends RETURNING INTO',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('Oracle')
							.setScope('Animal')
							.addRecord({IDAnimal:null, Name:'Foo Foo', Age:15});
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.buildCreateQuery();
						Expect(tmpQuery.query.body)
							.to.equal("INSERT INTO Animal ( Name, Age) VALUES ( :Name_0, :Age_1) RETURNING IDAnimal INTO :RETURNING_ID");
					}
				);
				test
				(
					'Bad Create Query returns false',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable).setDialect('Oracle');
						tmpQuery.buildCreateQuery();
						tmpQuery.addRecord({});
						tmpQuery.buildCreateQuery();
						Expect(tmpQuery.query.body)
							.to.equal(false);
					}
				);
			}
		);

		suite
		(
			'Read Query Generation',
			function()
			{
				test
				(
					'Simple Read Query (no quoting)',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable).setDialect('Oracle').setScope('Animal');
						tmpQuery.addSort({Column:'Cost',Direction:'Descending'});
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT Animal.* FROM Animal ORDER BY Cost DESC');
					}
				);
				test
				(
					'Read Query with named binds and OFFSET/FETCH pagination',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('Oracle')
							.setScope('Animal')
							.setDataElements(['Name', 'Age'])
							.setCap(10)
							.setBegin(0)
							.addFilter('Age', '15')
							.addSort('Age');
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT Name, Age FROM Animal WHERE Age = :Age_w0 ORDER BY Age OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY');
					}
				);
				test
				(
					'Complex Read Query expands IN lists into discrete binds',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('Oracle')
							.setScope('Animal')
							.setDataElements(['Name', 'Age', 'Cost'])
							.setCap(100)
							.addFilter('Age', '25')
							.addFilter('', '', '(')
							.addFilter('Color', 'Red')
							.addFilter('Color', 'Green', '=', 'OR')
							.addFilter('', '', ')')
							.addFilter('Description', '', 'IS NOT NULL')
							.addFilter('IDOffice', [10, 11, 15, 18, 22], 'IN');
						tmpQuery.addSort('Age');
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT Name, Age, Cost FROM Animal WHERE Age = :Age_w0 AND ( Color = :Color_w2 OR Color = :Color_w3 ) AND Description IS NOT NULL AND IDOffice IN (:IDOffice_w6_0, :IDOffice_w6_1, :IDOffice_w6_2, :IDOffice_w6_3, :IDOffice_w6_4) ORDER BY Age OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY');
					}
				);
				test
				(
					'Read Query with schema injects soft-delete filter and PK ORDER BY',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('Oracle')
							.setScope('Animal')
							.setDataElements(['Name', 'Age', 'Cost'])
							.setCap(100);
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT Name, Age, Cost FROM Animal WHERE Deleted = :Deleted_w0 ORDER BY IDAnimal OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY');
					}
				);
				test
				(
					'Read Query with quoteIdentifiers wraps identifiers in double quotes',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('Oracle')
							.setScope('Animal')
							.setDataElements(['Name', 'Age'])
							.addSort('Age');
						tmpQuery.parameters.quoteIdentifiers = true;
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT "Name", "Age" FROM "Animal" ORDER BY "Age"');
					}
				);
				test
				(
					'Custom Read Query honors the query override template',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('Oracle')
							.setScope('Animal')
							.setCap(10)
							.setBegin(0)
							.setDataElements(['Name', 'Age', 'Cost'])
							.setFilter({Column:'Age',Operator:'=',Value:'15',Connector:'AND',Parameter:'Age'});
						tmpQuery.parameters.queryOverride = 'SELECT Name, Age * 5, Cost FROM <%= TableName %> <%= Where %> <%= Limit %>';
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT Name, Age * 5, Cost FROM  Animal  WHERE Age = :Age_w0  OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY');
					}
				);
			}
		);

		suite
		(
			'Legacy Pagination (ROWNUM double-subquery)',
			function()
			{
				test
				(
					'legacyPagination wraps the query in a ROWNUM subquery (caller sort)',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('Oracle')
							.setScope('Animal')
							.setDataElements(['Name', 'Age', 'Cost'])
							.setCap(10)
							.setBegin(20)
							.addSort('Age');
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.parameters.legacyPagination = true;
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT Name, Age, Cost FROM (SELECT meadow_inner.*, ROWNUM AS "_RowNum" FROM (SELECT Name, Age, Cost FROM Animal WHERE Deleted = :Deleted_w0 ORDER BY Age) meadow_inner WHERE ROWNUM <= 30) WHERE "_RowNum" > 20');
					}
				);
				test
				(
					'legacyPagination injects PK ORDER BY when caller omits sort',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('Oracle')
							.setScope('Animal')
							.setDataElements(['Name', 'Age', 'Cost'])
							.setCap(10);
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.parameters.legacyPagination = true;
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT Name, Age, Cost FROM (SELECT meadow_inner.*, ROWNUM AS "_RowNum" FROM (SELECT Name, Age, Cost FROM Animal WHERE Deleted = :Deleted_w0 ORDER BY IDAnimal) meadow_inner WHERE ROWNUM <= 10) WHERE "_RowNum" > 0');
					}
				);
				test
				(
					'legacyPagination is inert without a cap',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('Oracle')
							.setScope('Animal')
							.setDataElements(['Name']);
						tmpQuery.parameters.legacyPagination = true;
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT Name FROM Animal');
					}
				);
			}
		);

		suite
		(
			'Update / Delete / Undelete Query Generation',
			function()
			{
				test
				(
					'Update Query auto-stamps UpdateDate with SYS_EXTRACT_UTC',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable).setDialect('Oracle')
							.setScope('Animal')
							.addFilter('IDAnimal', 9)
							.addRecord({
								IDAnimal:82,
								GUIDAnimal:'1111-2222-3333-4444-5555-6666-7777',
								CreateDate:false,
								CreatingIDUser:false,
								UpdateDate:false,
								UpdatingIDUser:false,
								Name:'Froo Froo',
								Age:18
							});
						tmpQuery.query.schema = _AnimalSchemaWithoutDeleted;
						tmpQuery.buildUpdateQuery();
						Expect(tmpQuery.query.body)
							.to.equal('UPDATE Animal SET GUIDAnimal = :GUIDAnimal_0, UpdateDate = SYS_EXTRACT_UTC(SYSTIMESTAMP), UpdatingIDUser = :UpdatingIDUser_2, Name = :Name_3, Age = :Age_4 WHERE IDAnimal = :IDAnimal_w0');
					}
				);
				test
				(
					'Update Query with disabled stamps parameterizes UpdateDate',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable).setDialect('Oracle')
							.setScope('Animal')
							.addFilter('IDAnimal', 9)
							.setDisableAutoUserStamp(true)
							.setDisableAutoDateStamp(true)
							.addRecord({
								IDAnimal:82,
								GUIDAnimal:'1111-2222-3333-4444-5555-6666-7777',
								CreateDate:false,
								CreatingIDUser:false,
								UpdateDate:false,
								UpdatingIDUser:false,
								Name:'Froo Froo',
								Age:18
							});
						tmpQuery.query.schema = _AnimalSchemaWithoutDeleted;
						tmpQuery.buildUpdateQuery();
						Expect(tmpQuery.query.body)
							.to.equal('UPDATE Animal SET GUIDAnimal = :GUIDAnimal_0, UpdateDate = :MANUAL_UpdateDate, Name = :Name_2, Age = :Age_3 WHERE IDAnimal = :IDAnimal_w0');
					}
				);
				test
				(
					'Delete Query converts to soft-delete UPDATE when a Deleted column exists',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable).setDialect('Oracle')
							.setScope('Animal')
							.addFilter('IDAnimal', 10);
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.buildDeleteQuery();
						Expect(tmpQuery.query.body)
							.to.equal('UPDATE Animal SET UpdateDate = SYS_EXTRACT_UTC(SYSTIMESTAMP), Deleted = 1, DeletingIDUser = :DeletingIDUser_2, DeleteDate = SYS_EXTRACT_UTC(SYSTIMESTAMP) WHERE IDAnimal = :IDAnimal_w0 AND Deleted = :Deleted_w1');
					}
				);
				test
				(
					'Delete Query is a hard DELETE when there is no Deleted column',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable).setDialect('Oracle')
							.setScope('Animal')
							.addFilter('IDAnimal', 9)
							.addRecord({IDAnimal:82, GUIDAnimal:'1111-2222'});
						tmpQuery.query.schema = _AnimalSchemaWithoutDeleted;
						tmpQuery.buildDeleteQuery();
						Expect(tmpQuery.query.body)
							.to.equal('DELETE FROM Animal WHERE IDAnimal = :IDAnimal_w0');
					}
				);
				test
				(
					'Delete Query is a hard DELETE when delete tracking is disabled',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable).setDialect('Oracle')
							.setScope('Animal')
							.setDisableDeleteTracking(true)
							.addFilter('IDAnimal', 9)
							.addRecord({IDAnimal:82, GUIDAnimal:'1111-2222'});
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.buildDeleteQuery();
						Expect(tmpQuery.query.body)
							.to.equal('DELETE FROM Animal WHERE IDAnimal = :IDAnimal_w0');
					}
				);
				test
				(
					'Undelete Query clears the Deleted bit',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable).setDialect('Oracle')
							.setScope('Animal')
							.addFilter('IDAnimal', 10);
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.buildUndeleteQuery();
						Expect(tmpQuery.query.body)
							.to.equal('UPDATE Animal SET UpdateDate = SYS_EXTRACT_UTC(SYSTIMESTAMP), UpdatingIDUser = :UpdatingIDUser_1, Deleted = 0 WHERE IDAnimal = :IDAnimal_w0');
					}
				);
			}
		);

		suite
		(
			'Count Query Generation',
			function()
			{
				test
				(
					'Count Query injects soft-delete filter and aliases as RowCount',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable).setDialect('Oracle').setScope('Animal');
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.buildCountQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT COUNT(*) AS RowCount FROM Animal WHERE Deleted = :Deleted_w0');
					}
				);
				test
				(
					'Count Query honors DISTINCT on the selected field',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable).setDialect('Oracle')
							.setScope('Animal')
							.setDataElements(['Name'])
							.setDistinct(true);
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.buildCountQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT COUNT(DISTINCT Name) AS RowCount FROM Animal WHERE Deleted = :Deleted_w0');
					}
				);
			}
		);

		suite
		(
			'Oracle Bind Type Tracking',
			function()
			{
				test
				(
					'parameterTypes maps schema types to oracledb type strings',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('Oracle')
							.setScope('Animal')
							.addFilter('Age', 15)
							.addFilter('Name', 'Foo');
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.parameterTypes.Age_w0).to.equal('NUMBER');
						Expect(tmpQuery.query.parameterTypes.Name_w1).to.equal('STRING');
						Expect(tmpQuery.query.parameterTypes.Deleted_w2).to.equal('NUMBER');
					}
				);
			}
		);
	}
);
