"use strict"

const { MongoClient, ObjectID }  = require("mongodb");
// var ObjectID = require('mongodb').ObjectID;
const DBConfig = require('./Configs/config');
const moment = require('moment');
const connectionUrl = DBConfig.connectionUrl;
const databaseName = DBConfig.databaseName;


const SaveData = (ObjBookmark, next) => {
  try {
    MongoClient.connect(
      connectionUrl, {
        useNewUrlParser: true
      },
      async (error, client) => {
        if (client) {
          const db = client.db(databaseName);
          let searchedUser = await searchUser(db, ObjBookmark.userID);
          if (searchedUser.length === 0) {
            searchedUser = await createUser(db, ObjBookmark.userID);
          }
          db.collection("Bookmarks").find({
            url: {
              $in: ObjBookmark.bookmakArray.map(bmk => bmk.url)
            }
          }).toArray(function (err, foundBookmarks) {
            if (err) {
              console.log("Unable to find bookamrks : " + err);
              next();
              // return false;
            } else if (foundBookmarks) {
              //existing bookmarks where userinfo needs to be inserted (think of wrapping the para with foundBookmarks.length > 0 condition)
              //check and add only the user if it is not present in foundBookmarks user map in Bookmarks collection
              let bookamrksToInsertUser = foundBookmarks.filter(bmk =>bmk.users.findIndex(i => i.userKey === ObjBookmark.userID) === -1);
              bookamrksToInsertUser.forEach((bookmark) => {
                // find the custom title for the bookmark
                let bookmarkTitle = null;
                ObjBookmark.bookmakArray.find((o, i) => {
                  if (o.url === bookmark.url) {
                    bookmarkTitle = ObjBookmark.bookmakArray[i].title;
                    return true;
                  }
                });
                //call insert user API
                addUserInBookmark(db, bookmark, ObjBookmark.userID, bookmarkTitle);
              });

              //new bookmarks to be inserted in Bookmark collection
              let newBookmarksToInsert =  ObjBookmark.bookmakArray.filter((item) => 
                foundBookmarks.findIndex(i => i.url === item.url) === -1 )
              //Create the brand new Bookamrks in Bookmarks coll
              createBookmarks(db, newBookmarksToInsert, ObjBookmark.userID).then((savedNewBookmaks) => {

                let newBookmarkUrlsPerUser =[];
                let existingBookmarksPerUser = [];
                //existing bookmark array for user
                if(searchedUser[0] && searchedUser[0].bookmarks && searchedUser[0].bookmarks.length > 0) {
                  existingBookmarksPerUser = searchedUser[0].bookmarks;
                }
                //bookmark NOT present in user in Userdetails coll but present in Bookmarks coll combined with brand new saved bookmark ids
                newBookmarkUrlsPerUser = foundBookmarks.filter((foundBookmark) => existingBookmarksPerUser.findIndex(bmk => bmk.url === foundBookmark.url) === -1)
                  .concat(savedNewBookmaks).map(bmk => bmk.url);
                //call insert bookmark in user API
                addBookmarkInUser(db, ObjBookmark.userID, newBookmarkUrlsPerUser).then((upsertedCount) => {
                  console.log("Bookmarks added in user");
                  next();
                }, (bookmarkAdditionErr) => {
                  console.log('Error while adding bookmarks in user');
                  next();
                });
              }, (bookmarkCreationErr) => {
                console.log('Error while creating bookmarks');
                next();
              });
            }
          })
        } else if (err) {
          console.log("Unable to Connect to db : " + err);
          next();
          // return false;
        }
      })
  } catch (error) {
    next();
  }
}

//Create new bookmarks based on url,title map in Bookmarks coll
const createBookmarks = (objDB, urls, userID) => {
  let urlObjects = [];
  urls.forEach((item, index) => {
    let userInfo = [];
    userInfo.push({
      userKey: userID,
      bookmarkTitle: item.title,
      dateAdded: moment().format(),
      dateModified: moment().format()
    })
    urlObjects.push({
      url: item.url,
      imageName: item.imageName,
      users: userInfo,
      hitCount: 0,
      shardInfo: item.imageName.charAt(0).toLowerCase() || 'default',
      priority: index
    })
  })
  return new Promise((resolve, reject) => {
    if (urls.length === 0)
      resolve([]);
    else
      objDB.collection("Bookmarks").insertMany(urlObjects,
        (err, response) => {
          if (err) {
            console.log("Unable to create bookmarks :" + err);
            reject([]);
          } else {
            if (response) {
              resolve(response.ops);
            }
          }
        })
  })
}

//Add a new user in existing bookmark in Bookmarks coll
const addUserInBookmark = (objDB, bookamrkToUpdate, userKey, bookmarkTitle) => {
  return new Promise((resolve, reject) => {
    let userInfo = {
      userKey: userKey,
      bookmarkTitle: bookmarkTitle,
      dateAdded: moment().format(),
      dateModified: moment().format()
    }
    objDB.collection("Bookmarks").updateOne({
      _id: bookamrkToUpdate._id,
      shardInfo: bookamrkToUpdate.shardInfo
    }, {
      $push: {
        users: userInfo
      }
    },
    (err, userUpdatedresult) => {
      if (err) {
        console.log("Unable to Insert user in bookmark: " + err);
        reject(false);
      } else if (userUpdatedresult) {
        console.log("User updated");
        resolve(userInfo);
      }
    });
  });
};

//Search an user in UserDetails coll
const searchUser = async (objDB, userId) => {
  return new Promise((resolve, rej) => {
    objDB.collection("Userdetails").find({
      userKey: userId,
      shardInfo: userId.charAt(0).toLowerCase() || 'default'
    }).toArray((err, userSearchResult) => {
      if (err) {
        console.log("Unable to search user : " + err);
        rej([]);
      } else if (userSearchResult) {
        resolve(userSearchResult)
      }
    })
  })
}

//Create a new user in UserDetails coll
const createUser = async (objDB, newUserID) => {
  return new Promise((resolve, reject) => {
    objDB.collection("Userdetails").insertOne({
        userKey: newUserID,
        dateAdded: moment().format(),
        lastActive: moment().format(),
        shardInfo: newUserID.charAt(0).toLowerCase() || 'default',
        bookmarks:[]
      },
      (err, userInsertedresult) => {
        if (err) {
          console.log("Unable to create user : " + err);
          reject(false);
        } else if (userInsertedresult) {
          console.log("Created new user");
          resolve(userInsertedresult.ops[0]);
        }
      })
  })
}

//Add a new bookmark in existing user in UserDetails coll
const addBookmarkInUser = async (objDB, userID, bookmarkUrls) => {
  return new Promise((resolve, reject) => {
    let bookmarkInfo = [];
    bookmarkUrls.forEach((bmkUrl) => {
      bookmarkInfo.push({
        url: bmkUrl,
        hitCount: 0
      });
    })
    objDB.collection("Userdetails").updateOne({
        userKey: userID,
        shardInfo: userID.charAt(0).toLowerCase() || 'default'
      }, {
        $push: {
          bookmarks: {
            $each: bookmarkInfo
          }
        }
      },
      (err, userUpdatedresult) => {
        if (err) {
          console.log("Unable to insert bookmark in user : " + err);
          reject(false);
        } else if (userUpdatedresult) {
          console.log("User updated");
          resolve(userUpdatedresult.upsertedCount);
        }
      });
    // }
  })
}

//Increase the hit count of a bookmak
const UpdateHitCount = (ObjHitCount, callback) => {
  try {
    MongoClient.connect(
      connectionUrl, {
        useNewUrlParser: true
      },
      (error, client) => {
        if (client) {
          const db = client.db(databaseName);

          db.collection("Userdetails").updateOne({
            userKey: ObjHitCount.userID,
            shardInfo: ObjHitCount.userID.charAt(0).toLowerCase() || 'default',
            "bookmarks.url": ObjHitCount.url
          }, {
            $inc: { "bookmarks.$.hitCount": 1 }
          },
          (err, userUpdatedresult) => {
            if (err) {
              console.log("Unable to increase hitcount in user : " + err);
              // reject(false);
            } else if (userUpdatedresult) {
              console.log("Increased hitcount");
              callback();
              // resolve(bookmarkInfo);
            }
          });

          db.collection("Bookmarks").updateOne({
            url: ObjHitCount.url,
            shardInfo: ObjHitCount.shardInfo
          }, {
            $inc: { hitCount: 1 }
          },
          (err, userUpdatedresult) => {
            if (err) {
              console.log("Unable to increase hitcount in bookmark : " + err);
              // reject(false);
            } else if (userUpdatedresult) {
              console.log("User updated", userUpdatedresult);
              callback();
              // resolve(bookmarkInfo);
            }
          });

        }
      }
    )

  } catch (error) {
    callback();
  }
}
module.exports = {
  SaveData,
  UpdateHitCount
};