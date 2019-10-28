"use strict"

var MongoClient = require("mongodb");
let ObjectID = require('mongodb').ObjectID
var DBConfig = require('./Configs/config');
var moment = require('moment');
const connectionUrl = DBConfig.connectionUrl;
const databaseName = DBConfig.databaseName;


const SaveImageData = (ObjBookmark, callback) => {
  try {
    MongoClient.connect(
      connectionUrl, {
        useNewUrlParser: true
      },
      async (error, client) => {
        if (client) {
          const db = client.db(databaseName);

          let searchedUser = await searchUser(db, ObjBookmark.userID);
          // let existingBookmarksForUser = [];
          // let existingBookmarkurls = {};
          if (searchedUser.length === 0) {
            searchedUser = await createUser(db, ObjBookmark.userID);
          } else {
            // existingBookmarkurls = {
            //   ...searchedUsers[0].bookmarks
            // };
            // Object.keys(searchedUsers[0].bookmarks).forEach((item) => {
            //   existingBookmarksForUser.push(searchedUsers[0].bookmarks[item]._id);
            // })
          }
          db.collection("Bookmarks").find({
            url: {
              $in: ObjBookmark.bookmakArray.map(bmk => bmk.url)
            }
          }).toArray(function (err, foundBookmarks) {
            if (err) {
              console.log(err);
              return false;
            } else if (foundBookmarks) {
              //new bookmarks in 'Bookmark' Collection
              // let newBookmarks = result.filter((item) => {
              //   return !this.has(item)
              // }, new Set(ObjBookmark.bookmakArray));
              
              //new bookmarks to be inserted in Bookmark collection
              let newBookmarksToInsert =  ObjBookmark.bookmakArray.filter((item) => 
              foundBookmarks.findIndex(i => i.url === item.url) === -1 )

              //if bookmarks tobe inserted in Bookamrks are brand new
              // if (newBookmarksToInsert.length > 0) {
                saveBookmarks(db, newBookmarksToInsert, ObjBookmark.userID).then((savedNewBookmaks) => {
                  let newBookmarkIdsPerUser =[];
                  let existingBookmarksPerUser = {};

                  // let allBookmarkIds = [...new set(foundBookmarks.map((item) => item._id).concat(savedNewBookmakIDs))];
                  
                  //existing bookmark object for user
                  if(searchedUser[0] && searchedUser[0].bookmarks) {
                    existingBookmarksPerUser = searchedUser[0].bookmarks;
                  }
                  
                  //bookmark NOT present in User coll but present in Bookmarks coll combined with brand new saved bookmark ids
                  newBookmarkIdsPerUser = foundBookmarks.map((foundBookmark) => {
                    if(!existingBookmarksPerUser[foundBookmark._id]) {
                      return foundBookmark._id
                    }
                  }).concat(savedNewBookmaks.map(bmk => bmk._id));

                  updateUserDetails(db, ObjBookmark.userID, newBookmarkIdsPerUser, existingBookmarksPerUser).then(() => {
                    console.log('bookmarks updated in user collection');
                    console.log('bookmarks updated in user collection');
                  })
                })
              // } else {

              // }
            }
          })
        } else if (error) {
          console.log("Unable to Connect");
          return false;
        }
      })
    callback();
  } catch (error) {
    callback();
  }
}

const saveBookmarks = (objDB, urls, userID) => {
  let urlObjects = [];
  urls.map((item) => {
    let userInfo = {};
    userInfo[userID] = {
      urlDescription: item.description
    }
    urlObjects.push({
      url: item.url,
      imageName: item.imageName,
      users: userInfo,
      hitCount: 0,
      shardInfo: item.imageName.charAt(0).toLowerCase() || 'default'
    })
  })
  return new Promise((resolve, reject) => {
    if (urls.length === 0)
      resolve([]);
    else
      objDB.collection("Bookmarks").insertMany(urlObjects,
        (err, response) => {
          if (err) {
            console.log("Unable to insert :" + err);
            reject([]);
          } else {
            if (response) {
              resolve(response.ops);
            }
          }
        })
  })
}

const searchUser = async (objDB, userId) => {
  return new Promise((resolve, rej) => {
    objDB.collection("Userdetails").find({
      userKey: userId,
      shardInfo: userId.charAt(0).toLowerCase() || 'default'
    }).toArray((err, userSearchResult) => {
      if (err) {
        console.log("Unable to Insert");
        rej([]);
      } else if (userSearchResult) {
        resolve(userSearchResult)
      }
    })
  })
}

const createUser = async (objDB, newUserID) => {
  return new Promise((resolve, reject) => {
    objDB.collection("Userdetails").insertOne({
        userKey: newUserID,
        dateAdded: moment().format(),
        lastActive: moment().format(),
        shardInfo: newUserID.charAt(0).toLowerCase() || 'default'
      },
      (err, userInsertedresult) => {
        if (err) {
          console.log("Unable to Insert");
          reject(false);
        } else if (userInsertedresult) {
          console.log("Inserted, User key : ", userInsertedresult.userKey);
          resolve(userInsertedresult.ops[0]);
        }
      })
  })
}

const updateUserDetails = async (objDB, userID, bookmarkIDs, existingBookmarks) => {
  return new Promise((resolve, reject) => {
    let bookmarkInfo = {
      ...existingBookmarks
    };
    bookmarkIDs.map((item) => {
      bookmarkInfo[item] = {
        hitCount: 0,
        dateAdded: moment().format(),
        dateModified: moment().format()
      };
    })
    objDB.collection("Userdetails").updateOne({
        userKey: userID,
        shardInfo: userID.charAt(0).toLowerCase() || 'default'
      }, {
        $set: {
          bookmarks: bookmarkInfo
        }
      },
      (err, userUpdatedresult) => {
        if (err) {
          console.log("Unable to Insert");
          reject(false);
        } else if (userUpdatedresult) {
          console.log("User updated", userUpdatedresult);
          resolve(bookmarkInfo);
        }
      });
    // }
  })
}
const UpdateHitCount = async (ObjHitCount, callback) => {
  try {
    MongoClient.connect(
      connectionUrl, {
        useNewUrlParser: true
      },
      (error, client) => {
        if (client) {
          const db = client.db(databaseName);
          db.collection("Bookmarks").find({
            url: ObjHitCount.url
          }).toArray(function (err, result) {
            if (err) {
              console.log(err);
              return false;
            } else if (result.length > 0) {
              result = result[0]
              let userInfo = {
                hitCount: result.users[ObjHitCount.userID].hitCount + 1,
                dateAdded: result.users[ObjHitCount.userID].dateAdded,
                dateModified: moment().format()
              }
              let path = `users.${ObjHitCount.userID}`
              db.collection("Bookmarks").updateOne({
                _id: ObjectID(result._id),
                shardInfo: 'y'
              }, {
                $set: {
                  [path]: userInfo
                }
              }, (err, resultUpdateCount) => {
                if (err) {
                  console.log("Unable to Update");
                } else if (resultUpdateCount) {
                  console.log(resultUpdateCount);
                }
                callback()
              })
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
  SaveImageData,
  UpdateHitCount
};