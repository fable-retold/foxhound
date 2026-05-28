let getDialects = () =>
{
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
}

module.exports = getDialects();