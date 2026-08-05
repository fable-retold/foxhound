/**
* Unit tests for FoxHound PostgreSQL Dialect
*
* @license     MIT
*
* @author      Steven Velozo <steven@velozo.com>
*/

var Chai = require('chai');
var Expect = Chai.expect;
var Assert = Chai.assert;

var libFable = require('fable');
const _Fable = new libFable({Product:'FoxhoundTestsPostgreSQL'});
var libFoxHound = require('../source/FoxHound.js');

var _AnimalSchema = (
[
	{ Column: "IDAnimal",        Type:"AutoIdentity" },
	{ Column: "GUIDAnimal",      Type:"AutoGUID" },
	{ Column: "CreateDate",      Type:"CreateDate" },
	{ Column: "CreatingIDUser",  Type:"CreateIDUser" },
	{ Column: "UpdateDate",        Type:"UpdateDate" },
	{ Column: "UpdatingIDUser", Type:"UpdateIDUser" },
	{ Column: "Deleted",         Type:"Deleted" },
	{ Column: "DeletingIDUser",  Type:"DeleteIDUser" },
	{ Column: "DeleteDate",      Type:"DeleteDate" }
]);

var _AnimalSchemaWithoutDeleted = (
[
	{ Column: "IDAnimal",        Type:"AutoIdentity" },
	{ Column: "GUIDAnimal",      Type:"AutoGUID" },
	{ Column: "CreateDate",      Type:"CreateDate" },
	{ Column: "CreatingIDUser",  Type:"CreateIDUser" },
	{ Column: "UpdateDate",        Type:"UpdateDate" },
	{ Column: "UpdatingIDUser", Type:"UpdateIDUser" }
]);

suite
(
	'FoxHound-Dialect-PostgreSQL',
	function()
	{
		setup
		(
			function()
			{
			}
		);

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
						var testFoxHound = libFoxHound.new(_Fable).setDialect('PostgreSQL');
						Expect(testFoxHound.dialect.name)
							.to.equal('PostgreSQL');
						Expect(testFoxHound)
							.to.be.an('object', 'FoxHound with PostgreSQL should initialize as an object directly from the require statement.');
					}
				);
			}
		);

		suite
		(
			'Basic Query Generation',
			function()
			{
				test
				(
					'Create Query',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setLogLevel(5)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.addRecord({IDAnimal:null, Name:'Foo Foo', Age:15});
						tmpQuery.buildCreateQuery();
						_Fable.log.trace('Create Query', tmpQuery.query);
						Expect(tmpQuery.query.body)
							.to.equal('INSERT INTO "Animal" ( "IDAnimal", "Name", "Age") VALUES ( :IDAnimal_0, :Name_1, :Age_2) RETURNING *;');
					}
				);
				test
				(
					'Create Query with Schema uses DEFAULT for AutoIdentity',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.addRecord({IDAnimal:null, GUIDAnimal:false, CreateDate:null, CreatingIDUser:null, UpdateDate:null, UpdatingIDUser:null, Deleted:0, Name:'Foo Foo', Age:15});
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.query.IDUser = 37;
						tmpQuery.query.UUID = 'test-guid-value';
						tmpQuery.buildCreateQuery();
						_Fable.log.trace('Create Query with Schema', tmpQuery.query);
						// AutoIdentity should use DEFAULT (not NULL like MySQL)
						Expect(tmpQuery.query.body).to.contain('DEFAULT');
						Expect(tmpQuery.query.body).to.contain('RETURNING *');
						Expect(tmpQuery.query.body).to.contain('NOW()');
						Expect(tmpQuery.query.body).to.not.contain('NOW(3)');
					}
				);
				test
				(
					'Bad Create Query',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable).setDialect('PostgreSQL');
						tmpQuery.buildCreateQuery();
						tmpQuery.addRecord({});
						tmpQuery.buildCreateQuery();
						_Fable.log.trace('Create Query', tmpQuery.query);
						Expect(tmpQuery.query.body)
							.to.equal(false);
					}
				);
				test
				(
					'Read Query',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable).setDialect('PostgreSQL').setScope('Animal');
						tmpQuery.addSort({Column:'Cost',Direction:'Descending'});
						tmpQuery.buildReadQuery();
						_Fable.log.trace('Simple Select Query', tmpQuery.query);
						Expect(tmpQuery.query.body)
							.to.equal('SELECT "Animal".* FROM "Animal" ORDER BY "Cost" DESC;');
					}
				);
				test
				(
					'Read Query with Distinct',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable).setDialect('PostgreSQL').setScope('Animal');
						tmpQuery.addSort({Column:'Cost',Direction:'Descending'})
							.setDistinct(true);
						tmpQuery.buildReadQuery();
						_Fable.log.trace('Simple Select Query', tmpQuery.query);
						Expect(tmpQuery.query.body)
							.to.equal('SELECT DISTINCT "Animal".* FROM "Animal" ORDER BY "Cost" DESC;');
					}
				);
				test
				(
					'Complex Read Query uses LIMIT/OFFSET syntax',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.setCap(10)
							.setBegin(0)
							.setDataElements(['Name', 'Age', 'Cost'])
							.setSort([{Column:'Age',Direction:'Ascending'}])
							.setFilter({Column:'Age',Operator:'=',Value:'15',Connector:'AND',Parameter:'Age'});
						tmpQuery.addSort('Cost');
						tmpQuery.buildReadQuery();
						_Fable.log.trace('Select Query', tmpQuery.query);
						Expect(tmpQuery.query.body)
							.to.equal('SELECT "Name", "Age", "Cost" FROM "Animal" WHERE "Age" = :Age_w0 ORDER BY "Age", "Cost" LIMIT 10 OFFSET 0;');
					}
				);
				test
				(
					'Complex Read Query with qualified and unqualified "SELECT *" cases',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.setCap(10)
							.setBegin(0)
							.setDataElements(['*', 'Name', 'Age', 'Cost', 'Animal.*'])
							.setSort([{Column:'Age',Direction:'Ascending'}])
							.setFilter({Column:'Age',Operator:'=',Value:'15',Connector:'AND',Parameter:'Age'});
						tmpQuery.addSort('Cost');
						tmpQuery.buildReadQuery();
						_Fable.log.trace('Select Query', tmpQuery.query);
						Expect(tmpQuery.query.body)
							.to.equal('SELECT *, "Name", "Age", "Cost", "Animal".* FROM "Animal" WHERE "Age" = :Age_w0 ORDER BY "Age", "Cost" LIMIT 10 OFFSET 0;');
					}
				);
				test
				(
					'Complex Read Query with Filters',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
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
						tmpQuery.setLogLevel(3).addSort('Age');
						tmpQuery.buildReadQuery();
						_Fable.log.trace('Select Query', tmpQuery.query);
						Expect(tmpQuery.query.body)
							.to.equal('SELECT "Name", "Age", "Cost" FROM "Animal" WHERE "Age" = :Age_w0 AND ( "Color" = :Color_w2 OR "Color" = :Color_w3 ) AND "Description" IS NOT NULL AND "IDOffice" IN ( :IDOffice_w6 ) ORDER BY "Age" LIMIT 100;');
					}
				);
				test
				(
					'Update Query',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.addFilter('IDAnimal', 9)
							.addRecord({Name:'Froggy', Age:12});
						tmpQuery.buildUpdateQuery();
						_Fable.log.trace('Update Query', tmpQuery.query);
						Expect(tmpQuery.query.body)
							.to.equal('UPDATE "Animal" SET "Name" = :Name_0, "Age" = :Age_1 WHERE "IDAnimal" = :IDAnimal_w0;');
					}
				);
				test
				(
					'Count Query',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.addFilter('Age', '3');
						tmpQuery.buildCountQuery();
						_Fable.log.trace('Count Query', tmpQuery.query);
						Expect(tmpQuery.query.body)
							.to.equal('SELECT COUNT(*) AS RowCount FROM "Animal" WHERE "Age" = :Age_w0;');
					}
				);
				test
				(
					'Delete Query with soft delete schema',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.addFilter('IDAnimal', 9);
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.query.IDUser = 37;
						tmpQuery.buildDeleteQuery();
						_Fable.log.trace('Delete Query', tmpQuery.query);
						Expect(tmpQuery.query.body)
							.to.contain('UPDATE "Animal" SET');
						Expect(tmpQuery.query.body)
							.to.contain('"Deleted" = 1');
						Expect(tmpQuery.query.body)
							.to.contain('NOW()');
					}
				);
				test
				(
					'Delete Query without schema does hard delete',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.addFilter('IDAnimal', 9);
						tmpQuery.buildDeleteQuery();
						_Fable.log.trace('Delete Query', tmpQuery.query);
						Expect(tmpQuery.query.body)
							.to.equal('DELETE FROM "Animal" WHERE "IDAnimal" = :IDAnimal_w0;');
					}
				);
				test
				(
					'Undelete Query',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.addFilter('IDAnimal', 9);
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.query.IDUser = 37;
						tmpQuery.buildUndeleteQuery();
						_Fable.log.trace('Undelete Query', tmpQuery.query);
						Expect(tmpQuery.query.body)
							.to.contain('UPDATE "Animal" SET');
						Expect(tmpQuery.query.body)
							.to.contain('"Deleted" = 0');
						Expect(tmpQuery.query.body)
							.to.contain('NOW()');
					}
				);
				test
				(
					'Read Query without LIMIT has no OFFSET',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal');
						tmpQuery.buildReadQuery();
						_Fable.log.trace('Select Query', tmpQuery.query);
						Expect(tmpQuery.query.body)
							.to.equal('SELECT "Animal".* FROM "Animal";');
						Expect(tmpQuery.query.body).to.not.contain('LIMIT');
						Expect(tmpQuery.query.body).to.not.contain('OFFSET');
					}
				);
				test
				(
					'Read Query uses double-quote identifiers (not backticks)',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.setDataElements(['Name', 'Age']);
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body).to.not.contain('`');
						Expect(tmpQuery.query.body).to.contain('"Name"');
						Expect(tmpQuery.query.body).to.contain('"Age"');
						Expect(tmpQuery.query.body).to.contain('"Animal"');
					}
				);
			}
		);

		suite
		(
			'Stable Pagination',
			function()
			{
				test
				(
					'A capped read with no sort orders by the identity column',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.setCap(500)
							.setBegin(1000);
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT "Animal".* FROM "Animal" WHERE "Animal"."Deleted" = :Deleted_w0 ORDER BY "IDAnimal" LIMIT 500 OFFSET 1000;');
					}
				);
				test
				(
					'A capped read with a caller sort appends the identity column as a tiebreaker',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.setCap(500)
							.setSort([{Column:'Name',Direction:'Descending'}]);
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT "Animal".* FROM "Animal" WHERE "Animal"."Deleted" = :Deleted_w0 ORDER BY "Name" DESC, "IDAnimal" LIMIT 500;');
					}
				);
				test
				(
					'A caller sort already on the identity column is left alone',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.setCap(500)
							.setSort([{Column:'IDAnimal',Direction:'Descending'}]);
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT "Animal".* FROM "Animal" WHERE "Animal"."Deleted" = :Deleted_w0 ORDER BY "IDAnimal" DESC LIMIT 500;');
					}
				);
				test
				(
					'An uncapped read is left unsorted',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal');
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body).to.not.contain('ORDER BY');
					}
				);
				test
				(
					'A DISTINCT read takes no identity sort',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.setDistinct(true)
							.setCap(500)
							.setDataElements(['Name', 'Age']);
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT DISTINCT "Name", "Age" FROM "Animal" WHERE "Animal"."Deleted" = :Deleted_w0 LIMIT 500;');
					}
				);
				test
				(
					'A query override takes no identity sort',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.setCap(500);
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.parameters.queryOverride = 'SELECT COUNT(*) FROM "Animal"<%= Where %> GROUP BY "Color"<%= OrderBy %><%= Limit %>;';
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT COUNT(*) FROM "Animal" WHERE "Animal"."Deleted" = :Deleted_w0 GROUP BY "Color" LIMIT 500;');
					}
				);
				test
				(
					'disableStableSort opts a capped read out',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.setCap(500);
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.parameters.disableStableSort = true;
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body).to.not.contain('ORDER BY');
					}
				);
				test
				(
					'A schema with no identity column leaves the read unsorted',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.setCap(500);
						tmpQuery.query.schema = [ { Column: 'Name', Type: 'String' }, { Column: 'Age', Type: 'Numeric' } ];
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body).to.not.contain('ORDER BY');
					}
				);
				test
				(
					'A non-AutoIdentity primary key is used when meadow plumbs defaultIdentifier',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('LakeTable')
							.setCap(500);
						tmpQuery.query.schema = [ { Column: 'IDLakeTable', Type: 'Numeric' }, { Column: 'Name', Type: 'String' } ];
						tmpQuery.query.defaultIdentifier = 'IDLakeTable';
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body)
							.to.equal('SELECT "LakeTable".* FROM "LakeTable" ORDER BY "IDLakeTable" LIMIT 500;');
					}
				);
				test
				(
					'A defaultIdentifier absent from the schema is never emitted',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('LakeTable')
							.setCap(500);
						// meadow defaults DefaultIdentifier to 'ID'+Scope, which need not exist.
						tmpQuery.query.schema = [ { Column: 'Name', Type: 'String' } ];
						tmpQuery.query.defaultIdentifier = 'IDLakeTable';
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body).to.not.contain('ORDER BY');
					}
				);
				test
				(
					'A joined read qualifies the identity column with the scope',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('Animal')
							.setCap(500);
						tmpQuery.query.schema = _AnimalSchema;
						tmpQuery.parameters.join = [ { Type: 'INNER JOIN', Table: 'Office', From: 'Animal.IDOffice', To: 'Office.IDOffice' } ];
						tmpQuery.buildReadQuery();
						Expect(tmpQuery.query.body).to.contain('ORDER BY "Animal"."IDAnimal"');
					}
				);
				test
				(
					'clone carries the identity column forward',
					function()
					{
						var tmpQuery = libFoxHound.new(_Fable)
							.setDialect('PostgreSQL')
							.setScope('LakeTable')
							.setCap(500);
						tmpQuery.query.schema = [ { Column: 'IDLakeTable', Type: 'Numeric' } ];
						tmpQuery.query.defaultIdentifier = 'IDLakeTable';

						var tmpClone = tmpQuery.clone().setDialect('PostgreSQL');
						tmpClone.buildReadQuery();
						Expect(tmpClone.query.body).to.contain('ORDER BY "IDLakeTable"');
					}
				);
			}
		);
	}
);
