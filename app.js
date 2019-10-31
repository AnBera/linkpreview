/**
 * Module dependencies.
 */
var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
const webshot = require('webshot');
var fs = require("fs");
const captureWebsite = require('capture-website');
var upsertMongodb=require("./mongoDB");
var async_lib = require("async");
var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use('/images', express.static(__dirname + '/images'));
app.use((req, res, nxt) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Header', '*');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', '*');
    return res.status(204).json({});
  }
  nxt();
});

const optionsMobile = {
  // screenSize: {
  //   width: 414,
  //   height: 736
  // },
  shotSize: {
    width: 500,
    height: 'all'
  }
  //userAgent: 'Mozilla/5.0 (iPhone; U; CPU iPhone OS 3_2 like Mac OS X; en-us) AppleWebKit/531.21.20 (KHTML, like Gecko) Mobile/7B298g'
};

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/users', user.list);
app.post('/increment',(req,res)=>{
  var hitCountObject = {}
  hitCountObject.userID = req.body.uniqueID;
  hitCountObject.url = req.body.url;
  hitCountObject.shardInfo = req.body.shardKey;

  upsertMongodb.UpdateHitCount(hitCountObject,()=>{
    res.status(200).send({
      data: true
    });
  });
});
app.post('/urlbatch', (req, res) => {
  let userid = req.body.uniqueID;
  let urlArray = req.body.bookmarks;
  
  let chunk = 5;
  let parellerlTasksCount = 1;
  let q = async_lib.queue((chunkBookmarks, next) => {
      console.log('Queue Length : ' + q.length());
      upsertMongodb.SaveImageData(chunkBookmarks, next);
    }, parellerlTasksCount);
  
  q.drain = () => {
      console.log('all items have been processed');
  };

  for (let i=0,j=urlArray.length; i<j; i+=chunk) {
    let chunkedArray = urlArray.slice(i,i+chunk);
    q.push({userID:userid, bookmakArray:chunkedArray});
  }
 
  res.status(200).send({
    queued: true,
    index: Math.ceil(urlArray.length/chunk),
    length: q.length(),
  });
  
});

app.get('/saveUrlToImage', function (req, res) {
  // create the screenshot
  webshot(req.query.url, 'images/output-thumbnail.png', optionsMobile, function (err) {
    if (!err) {
      console.log('screenshot taken!');
      res.status(200).json({
        'id': 'some image',
        'imgEncoded': "Image Created"
      });
    }
  });

});

app.post('/thumbnail', function (req, res) {
  // create the screenshot from https://github.com/sindresorhus/capture-website
  var urlArray = req.body;
  let callCount = 0;
  convertImages(urlArray, function () {
    callCount++;
    if (callCount >= urlArray.length)
      res.status(200).send({
        data: true
      });
  });
});

const extractHostname = url => {
  var hostname;

  //find & remove protocol (http, ftp, etc.) and get hostname
  if (url.indexOf("//") > -1) {
    hostname = url.split("/")[2];
  } else {
    hostname = url.split("/")[0];
  }

  //find & remove port number
  hostname = hostname.split(":")[0];
  //find & remove "?"
  hostname = hostname.split("?")[0];
  //replace initial www.
  hostname = hostname.replace(/^www./gi, '');

  return hostname;
};

var convertImages = async (urlArray, complete) => {
  async_lib.forEachOf(urlArray, async (url, index, callback) => {
    var fileName = "images/" + extractHostname(url) + ".png"; //url.replace(url.substring(0, url.indexOf(".") + 1), "") + ".png";
    if (!fs.existsSync(fileName)) {
      (async () => {
        await captureWebsite.file(url, fileName, {
          width: 920,
          height: 980,
          scaleFactor: 0.1
        })
      })()
      .then(() => {
        complete();
        callback()
      })

    } else {
      complete();
      callback();
    }
  })
}

var base64_encode = function (file) {
  // read binary data
  var bitmap = fs.readFileSync(file);
  // convert binary data to base64 encoded string
  return new Buffer(bitmap).toString('base64');
}

http.createServer(app).listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});