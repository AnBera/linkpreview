var MongoClient = require("mongodb");
let ObjectID = require('mongodb').ObjectID
var DBConfig = require('./Configs/config');
var moment = require('moment');
const connectionUrl = DBConfig.connectionUrl;
const databaseName = DBConfig.databaseName;


const SaveImageData = async (ObjBookmark, callback) => {
  try {
    MongoClient.connect(
      connectionUrl, {
        useNewUrlParser: true
      },
      (error, client) => {
        if (client) {
          const db = client.db(databaseName);
          let isUserPresent = false;
          searchUser(db, ObjBookmark.userID, ObjBookmark.userID.charAt(0).toLowerCase() || 'default').then((searchedUsers) => {
            if (searchedUsers.length > 0) {
              isUserPresent = true;
            }
            ObjBookmark.bookmakArray.forEach(element => {
              db.collection("Bookmarks").find({
                url: element.url
              }).toArray(function (err, result) {
                if (err) {
                  console.log(err);
                  return false;
                }
                /*If url is present*/
                else if (result.length > 0) {
                  let existingUser = result[0].users[ObjBookmark.userID];
                  /*If url is present, and user is new*/
                  if (!existingUser) {
                    let newUser = {
                      ...result[0].users
                    };
                    newUser[ObjBookmark.userID] = {
                      hitCount: 0,
                      dateAdded: moment().format(),
                      dateModified: moment().format()
                    }
                    db.collection("Bookmarks").updateOne({
                        url: result[0].url,
                        shardInfo: result[0].shardInfo
                      }, {
                        $set: {
                          users: newUser
                        }
                      },
                      (err, bookmarkUpdatedresult) => {
                        if (err) {
                          console.log("Unable to Update");
                          return false;
                        } else if (bookmarkUpdatedresult) {
                          updateUserDetails(db, isUserPresent, ObjBookmark.userID, bookmarkUpdatedresult.upsertedId, result[0].url).then((response) => {
                            console.log(response);
                            isUserPresent = response;
                          })
                        }
                      })
                  }
                }
                /*If url is not present*/
                else if (result.length === 0) {
                  let userInfo = {};
                  userInfo[ObjBookmark.userID] = {
                    hitCount: 0,
                    dateAdded: moment().format(),
                    dateModified: moment().format()
                  }
                  db.collection("Bookmarks").insertOne({
                      url: element.url,
                      imageName: element.imageName,
                      users: userInfo,
                      shardInfo: element.imageName.charAt(0).toLowerCase() || 'default'
                    },
                    (err, bookmarkInserted) => {
                      if (err) {
                        console.log("Unable to Insert");
                        return false;
                      } else if (bookmarkInserted) {
                        updateUserDetails(db, isUserPresent, ObjBookmark.userID, bookmarkInserted.insertedId, element.url).then((response) => {
                          console.log(response);
                          isUserPresent = response;
                        })
                      }
                    }
                  );
                }
              });
            });
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

const searchUser = async (objDB, userId) => {
  return new Promise((resolve, rej) => {
    objDB.collection("Userdetails").find({
      UserGeneratedKey: userId,
      userId: userId.charAt(0).toLowerCase() || 'default'
    }).toArray((err, userSearchResult) => {
      if (err) {
        console.log("Unable to Insert");
        rej([]);
      } else if (userSearchResult) {
        resolve(userSearchResult.length > 0 ? userSearchResult[0] : [])
      }
    })
  })
}

const updateUserDetails = async (objDB, userPresent, NewUserID, bookmarkID, bookmarkUrl) => {

  return new Promise((resolve, rej) => {
    if (!userPresent) {
      let bookmarkInfo = {};
      bookmarkInfo[bookmarkID] = {
        hitCount: 0,
        url: bookmarkUrl
      }
      objDB.collection("Userdetails").insertOne({
          UserGeneratedKey: NewUserID,
          dateAdded: moment().format(),
          lastActive: moment().format(),
          bookmarks: {
            bookmarkInfo
          },
          userId: NewUserID.charAt(0).toLowerCase() || 'default'
        },
        (err, UserInsertedresult) => {
          if (err) {
            console.log("Unable to Insert");
            rej(false);
          } else if (UserInsertedresult) {
            console.log("Inserted:", UserInsertedresult.insertedId);
            resolve(true);
          }
        })
    } else if (userPresent) {
      let bookmarkInfo = bookmarkID ? bookmarkInfo[bookmarkID] = {
        hitCount: 0,
        url: bookmarkUrl
      } : {};
      objDB.collection("Userdetails").updateOne({
          UserGeneratedKey: userPresent[0].userID,
          userId: userPresent[0].userID.charAt(0).toLowerCase() || 'default'
        }, {
          $set: bookmarkID ? {
            bookmarks: {
              ...userPresent[0].bookmarks,
              bookmarkInfo
            }
          } : {
            lastActive: moment().format()
          }
        },
        (err, userUpdatedresult) => {
          if (err) {
            console.log("Unable to Insert");
            rej(false);
          } else if (userUpdatedresult) {
            console.log("User updated", userUpdatedresult);
            resolve(userPresent);
          }
        });
    }
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

//[`users.${ObjBookmark.userID}`]: {$exists: true}