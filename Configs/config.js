let localConfig = {
  connectionUrl: 'process.env.CUSTOMCONNSTR_byConnectionString || mongodb://127.0.0.1:27017',
  databaseName: 'process.env.APPSETTING_byDbName'
};

module.exports = localConfig;