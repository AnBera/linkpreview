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
          ObjBookmark.bookmakArray.forEach(element => {
            /*Searching Bookmarks on DB*/
            db.collection("Bookmarks").find({
              url: element.url,
              shardInfo: element.imageName.charAt(0).toLowerCase() || 'default'
            }).toArray(function (err, bookmarkSearchresult) {
              if (err) {
                console.log(err);
                return false;
              }
              /*If url is present*/
              else if (bookmarkSearchresult.length > 0) {
                let existingUser = bookmarkSearchresult[0].users[ObjBookmark.userID];
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
                      url: bookmarkSearchresult[0].url,
                      shardInfo: bookmarkSearchresult[0].shardInfo
                    }, {
                      $set: {
                        users: newUser
                      }
                    },
                    (err, updateBookmarkresult) => {
                      if (err) {
                        console.log("Unable to Update");
                      } else if (updateBookmarkresult) {
                        db.collection("Userdetails").updateOne({
                            UserGeneratedKey: ObjBookmark.userID,
                            userId: ObjBookmark.userID.charAt(0).toLowerCase() || 'default'
                          }, {
                            $set: {
                              lastActive: moment().format()
                            }
                          },
                          (err, userUpdatedresult) => {
                            if (err) {
                              console.log("Unable to Insert");
                              return false;
                            } else if (userUpdatedresult) {
                              console.log("User updated", userUpdatedresult);
                              return true;
                              callback();
                            }
                          }
                        );
                      }
                    })
                } else {
                  // If User Already present //
                  db.collection("Userdetails").find({
                    UserGeneratedKey: ObjBookmark.userID,
                    userId: ObjBookmark.userID.charAt(0).toLowerCase() || 'default'
                  }).toArray((err, userSearchResult) => {
                    if (err) {
                      console.log("Unable to Insert");
                      return false;
                    } else if (userSearchResult) {
                      let bookmarkInfo = {};
                      bookmarkInfo[bookmarkSearchresult[0]._id] = {
                        hitCount: 0,
                        url: element.url
                      }
                      if (userSearchResult.length === 0) {
                        db.collection("Userdetails").insertOne({
                            UserGeneratedKey: ObjBookmark.userID,
                            dateAdded: moment().format(),
                            lastActive: moment().format(),
                            bookmarks: [bookmarkInfo],
                            userId: ObjBookmark.userID.charAt(0).toLowerCase() || 'default'
                          },
                          (err, UserInsertedresult) => {
                            if (err) {
                              console.log("Unable to Insert");
                              return false;
                            } else if (UserInsertedresult) {
                              console.log("Inserted:", UserInsertedresult);
                              return true;
                              callback();
                            }
                          }
                        );
                      } else if (userSearchResult.length > 0) {
                        // Update existing user details //
                        db.collection("Userdetails").updateOne({
                            UserGeneratedKey: ObjBookmark.userID,
                            userId: ObjBookmark.userID.charAt(0).toLowerCase() || 'default'
                          }, {
                            $set: {
                              bookmarks: [...userSearchResult[0].bookmarks, bookmarkInfo]
                            }
                          },
                          (err, userUpdated) => {
                            if (err) {
                              console.log("Unable to Insert");
                              return false;
                            } else if (userUpdated) {
                              console.log(`Updated for ${ObjBookmark.userID}`, userUpdated);
                              return true;
                              callback();
                            }
                          }
                        );
                      }
                    }
                  })
                }
              }
              /*If url is not present*/
              else if (bookmarkSearchresult.length === 0) {
                let userInfo = {};
                userInfo[ObjBookmark.userID] = {
                  dateAdded: moment().format(),
                  hitCount: 0
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
                      // If User Already present //
                      db.collection("Userdetails").find({
                        UserGeneratedKey: ObjBookmark.userID,
                        userId: ObjBookmark.userID.charAt(0).toLowerCase() || 'default'
                      }).toArray((err, userSearchresult) => {
                        if (err) {
                          console.log("Unable to Insert");
                          return false;
                        } else {
                          if (userSearchresult.length > 0) {
                            let bookmarkInfo = {};
                            bookmarkInfo[bookmarkInserted.insertedId] = {
                              hitCount: 0,
                              url: element.url
                            }
                            // Update existing user details //
                            db.collection("Userdetails").updateOne({
                                UserGeneratedKey: ObjBookmark.userID,
                                userId: ObjBookmark.userID.charAt(0).toLowerCase() || 'default'
                              }, {
                                $set: {
                                  bookmarks: [...userSearchresult[0].bookmarks, bookmarkInfo]
                                }
                              },
                              (err, userUpdated) => {
                                if (err) {
                                  console.log("Unable to Insert");
                                  return false;
                                } else if (userUpdated) {
                                  console.log(`Updated for ${ObjBookmark.userID}`, userUpdated);
                                  return true;
                                  callback();
                                }
                              }
                            );
                          } else {
                            let bookmarkInfo = {};
                            bookmarkInfo[bookmarkInserted.insertedId] = {
                              hitCount: 0,
                              url: element.url
                            }
                            // Create a new user //
                            db.collection("Userdetails").insertOne({
                                UserGeneratedKey: ObjBookmark.userID,
                                dateAdded: moment().format(),
                                lastActive: moment().format(),
                                bookmarks: [bookmarkInfo],
                                userId: ObjBookmark.userID.charAt(0).toLowerCase() || 'default'
                              },
                              (err, userInserted) => {
                                if (err) {
                                  console.log("Unable to Insert");
                                  return false;
                                } else if (userInserted) {
                                  console.log(`Insert for ${ObjBookmark.userID}`, userInserted);
                                  return true;
                                  callback();
                                }
                              }
                            );
                          }
                        }
                      });
                      return true;
                      callback();
                    }
                  }
                );
              }
            });
          });
        } else if (error) {
          console.log("Unable to Connect");
          return false;
          callback();
        }
      })
    callback();
  } catch (error) {
    callback();
  }
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
          })
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