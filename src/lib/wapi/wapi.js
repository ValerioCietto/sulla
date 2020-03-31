import {
  sendMessage,
  sendMessage2,
  createGroup,
  leaveGroup,
  getAllContacts,
  getMyContacts,
  getContact,
  getAllChats,
  hasUndreadMessages,
  getAllChatsWithNewMessages,
  getAllChatIds,
  getAllNewMessages
} from "./functions";
import {
  _serializeChatObj,
  _serializeContactObj,
  _serializeMessageObj,
  _serializeNumberStatusObj,
  _serializeRawObj,
  _serializeProfilePicThumb
} from "./serializers";
import { getStore } from "./store/get-store";

if (!window.Store) {
  (function() {
    webpackJsonp([], { parasite: (x, y, z) => getStore(z) }, ["parasite"]);
  })();
}

window.WAPI = {
  lastRead: {}
};

// Serializers assignations
window.WAPI._serializeRawObj = _serializeRawObj;
window.WAPI._serializeChatObj = _serializeChatObj;
window.WAPI._serializeContactObj = _serializeContactObj;
window.WAPI._serializeMessageObj = _serializeMessageObj;
window.WAPI._serializeNumberStatusObj = _serializeNumberStatusObj;
window.WAPI._serializeProfilePicThumb = _serializeProfilePicThumb;

// Functions
window.WAPI.createGroup = createGroup;
window.WAPI.leaveGroup = leaveGroup;
window.WAPI.getAllContacts = getAllContacts;
window.WAPI.getMyContacts = getMyContacts;
window.WAPI.getContact = getContact;
window.WAPI.getAllChats = getAllChats;
window.WAPI.hasUndreadMessages = hasUndreadMessages;
window.WAPI.getAllChatsWithNewMessages = getAllChatsWithNewMessages;
window.WAPI.getAllChatIds = getAllChatIds;
window.WAPI.getAllNewMessages = getAllNewMessages;

// window.WAPI.getAllUnreadMessages = async function() {
//   return JSON.stringify(
//     WAPI.getAllChatsWithNewMessages()
//       .map(c => WAPI.getChat(c.id._serialized))
//       .map(c => c.msgs._models.filter(x => x.ack == -1))
//       .flatMap(x => x) || []
//   );
// };`

window.WAPI.getAllChatsWithMessages = async function(onlyNew, done) {
  const x = [];
  if (onlyNew) {
    x.push(
      WAPI.getAllChatsWithNewMessages().map(c => WAPI.getChat(c.id._serialized))
    );
  } else {
    x.push(WAPI.getAllChatIds().map(c => WAPI.getChat(c)));
  }
  const result = (await Promise.all(x)).flatMap(x => x);
  return JSON.stringify(result);
};

/**
 * Fetches all groups objects from store
 *
 * @param done Optional callback function for async execution
 * @returns {Array|*} List of chats
 */
window.WAPI.getAllGroups = function(done) {
  const groups = window.Store.Chat.filter(chat => chat.isGroup);

  if (done !== undefined) done(groups);
  return groups;
};

/**
 * Fetches chat object from store by ID
 *
 * @param id ID of chat
 * @param done Optional callback function for async execution
 * @returns {T|*} Chat object
 */
window.WAPI.getChat = function(id, done) {
  id = typeof id == "string" ? id : id._serialized;
  const found = window.Store.Chat.get(id);
  if (found) {
    found.sendMessage = found.sendMessage
      ? found.sendMessage
      : function() {
          return window.Store.sendMessage.apply(this, arguments);
        };
  }

  if (done !== undefined) done(found);

  return found;
};

window.WAPI.getChatByName = function(name, done) {
  const found = window.Store.Chat.find(chat => chat.name === name);
  if (done !== undefined) done(found);
  return found;
};

window.WAPI.getWAVersion = function() {
  return window.DEBUG.VERSION;
};

window.WAPI.sendMessageMentioned = async function(
  chatId,
  message,
  mentioned,
) {
  var chat = WAPI.getChat(chatId);
  const user = await Store.Contact.serialize().find(x => x.id.user === mentioned);
  console.log(user);
  chat.sendMessage(message, {linkPreview : null, mentionedJidList : [user.id], quotedMsg : null, quotedMsgAdminGroupJid : null});
};

window.WAPI.sendMessageWithThumb = function(
  thumb,
  url,
  title,
  description,
  chatId,
  done
) {
  var chatSend = WAPI.getChat(chatId);
  if (chatSend === undefined) {
    if (done !== undefined) done(false);
    return false;
  }
  var linkPreview = {
    canonicalUrl: url,
    description: description,
    matchedText: url,
    title: title,
    thumbnail: thumb,
    compose: true
  };
  chatSend.sendMessage(url, {
    linkPreview: linkPreview,
    mentionedJidList: [],
    quotedMsg: null,
    quotedMsgAdminGroupJid: null
  });
  if (done !== undefined) done(true);
  return true;
};

window.WAPI.getNewId = function() {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 20; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
};

window.WAPI.getChatById = function(id, done) {
  let found = WAPI.getChat(id);
  if (found) {
    found = WAPI._serializeChatObj(found);
  } else {
    found = false;
  }

  if (done !== undefined) done(found);
  return found;
};

/**
 * I return all unread messages from an asked chat and mark them as read.
 *
 * :param id: chat id
 * :type  id: string
 *
 * :param includeMe: indicates if user messages have to be included
 * :type  includeMe: boolean
 *
 * :param includeNotifications: indicates if notifications have to be included
 * :type  includeNotifications: boolean
 *
 * :param done: callback passed by selenium
 * :type  done: function
 *
 * :returns: list of unread messages from asked chat
 * :rtype: object
 */
window.WAPI.getUnreadMessagesInChat = function(
  id,
  includeMe,
  includeNotifications,
  done
) {
  // get chat and its messages
  let chat = WAPI.getChat(id);
  let messages = chat.msgs._models;

  // initialize result list
  let output = [];

  // look for unread messages, newest is at the end of array
  for (let i = messages.length - 1; i >= 0; i--) {
    // system message: skip it
    if (i === "remove") {
      continue;
    }

    // get message
    let messageObj = messages[i];

    // found a read message: stop looking for others
    if (
      typeof messageObj.isNewMsg !== "boolean" ||
      messageObj.isNewMsg === false
    ) {
      continue;
    } else {
      messageObj.isNewMsg = false;
      // process it
      let message = WAPI.processMessageObj(
        messageObj,
        includeMe,
        includeNotifications
      );

      // save processed message on result list
      if (message) output.push(message);
    }
  }
  // callback was passed: run it
  if (done !== undefined) done(output);
  // return result list
  return output;
};

/**
 * Load more messages in chat object from store by ID
 *
 * @param id ID of chat
 * @param done Optional callback function for async execution
 * @returns None
 */
window.WAPI.loadEarlierMessages = function(id, done) {
  const found = WAPI.getChat(id);
  if (done !== undefined) {
    found.loadEarlierMsgs().then(function() {
      done();
    });
  } else {
    found.loadEarlierMsgs();
  }
};

/**
 * Load more messages in chat object from store by ID
 *
 * @param id ID of chat
 * @param done Optional callback function for async execution
 * @returns None
 */
window.WAPI.loadAllEarlierMessages = function(id, done) {
  const found = WAPI.getChat(id);
  x = function() {
    if (!found.msgs.msgLoadState.noEarlierMsgs) {
      found.loadEarlierMsgs().then(x);
    } else if (done) {
      done();
    }
  };
  x();
};

window.WAPI.asyncLoadAllEarlierMessages = function(id, done) {
  done();
  window.WAPI.loadAllEarlierMessages(id);
};

window.WAPI.areAllMessagesLoaded = function(id, done) {
  const found = WAPI.getChat(id);
  if (!found.msgs.msgLoadState.noEarlierMsgs) {
    if (done) done(false);
    return false;
  }
  if (done) done(true);
  return true;
};

/**
 * Load more messages in chat object from store by ID till a particular date
 *
 * @param id ID of chat
 * @param lastMessage UTC timestamp of last message to be loaded
 * @param done Optional callback function for async execution
 * @returns None
 */

window.WAPI.loadEarlierMessagesTillDate = function(id, lastMessage, done) {
  const found = WAPI.getChat(id);
  x = function() {
    if (
      found.msgs.models[0].t > lastMessage &&
      !found.msgs.msgLoadState.noEarlierMsgs
    ) {
      found.loadEarlierMsgs().then(x);
    } else {
      done();
    }
  };
  x();
};

/**
 * Fetches all group metadata objects from store
 *
 * @param done Optional callback function for async execution
 * @returns {Array|*} List of group metadata
 */
window.WAPI.getAllGroupMetadata = function(done) {
  const groupData = window.Store.GroupMetadata.map(groupData => groupData.all);

  if (done !== undefined) done(groupData);
  return groupData;
};

/**
 * Fetches group metadata object from store by ID
 *
 * @param id ID of group
 * @param done Optional callback function for async execution
 * @returns {T|*} Group metadata object
 */
window.WAPI.getGroupMetadata = async function(id, done) {
  let output = window.Store.GroupMetadata.get(id);

  if (output !== undefined) {
    if (output.stale) {
      await output.update();
    }
  }

  if (done !== undefined) done(output);
  return output;
};

/**
 * Fetches group participants
 *
 * @param id ID of group
 * @returns {Promise.<*>} Yields group metadata
 * @private
 */
window.WAPI._getGroupParticipants = async function(id) {
  const metadata = await WAPI.getGroupMetadata(id);
  return metadata.participants;
};

/**
 * Fetches IDs of group participants
 *
 * @param id ID of group
 * @param done Optional callback function for async execution
 * @returns {Promise.<Array|*>} Yields list of IDs
 */
window.WAPI.getGroupParticipantIDs = async function(id, done) {
  const output = (await WAPI._getGroupParticipants(id)).map(
    participant => participant.id
  );

  if (done !== undefined) done(output);
  return output;
};

window.WAPI.getGroupAdmins = async function(id, done) {
  const output = (await WAPI._getGroupParticipants(id))
    .filter(participant => participant.isAdmin)
    .map(admin => admin.id);

  if (done !== undefined) done(output);
  return output;
};

/**
 * Gets object representing the logged in user
 *
 * @returns {Array|*|$q.all}
 */
window.WAPI.getMe = function(done) {
  const rawMe = window.Store.Contact.get(window.Store.Conn.me);

  if (done !== undefined) done(rawMe.all);
  return rawMe.all;
};

window.WAPI.isLoggedIn = function(done) {
  // Contact always exists when logged in
  const isLogged =
    window.Store.Contact && window.Store.Contact.checksum !== undefined;

  if (done !== undefined) done(isLogged);
  return isLogged;
};

window.WAPI.isConnected = function(done) {
  // Phone Disconnected icon appears when phone is disconnected from the tnternet
  const isConnected =
    document.querySelector('*[data-icon="alert-phone"]') !== null
      ? false
      : true;

  if (done !== undefined) done(isConnected);
  return isConnected;
};

window.WAPI.processMessageObj = function(
  messageObj,
  includeMe,
  includeNotifications
) {
  if (messageObj.isNotification) {
    if (includeNotifications) return WAPI._serializeMessageObj(messageObj);
    else return;
    // System message
    // (i.e. "Messages you send to this chat and calls are now secured with end-to-end encryption...")
  } else if (messageObj.id.fromMe === false || includeMe) {
    return WAPI._serializeMessageObj(messageObj);
  }
  return;
};

window.WAPI.getAllMessagesInChat = function(
  id,
  includeMe,
  includeNotifications,
  done
) {
  const chat = WAPI.getChat(id);
  let output = [];
  const messages = chat.msgs._models;

  for (const i in messages) {
    if (i === "remove") {
      continue;
    }
    const messageObj = messages[i];

    let message = WAPI.processMessageObj(
      messageObj,
      includeMe,
      includeNotifications
    );
    if (message) output.push(message);
  }
  if (done !== undefined) done(output);
  return output;
};

window.WAPI.loadAndGetAllMessagesInChat = function(
  id,
  includeMe,
  includeNotifications,
  done
) {
  return WAPI.loadAllEarlierMessages(id).then(_ => {
    const chat = WAPI.getChat(id);
    let output = [];
    const messages = chat.msgs._models;

    for (const i in messages) {
      if (i === "remove") {
        continue;
      }
      const messageObj = messages[i];

      let message = WAPI.processMessageObj(
        messageObj,
        includeMe,
        includeNotifications
      );
      if (message) output.push(message);
    }
    if (done !== undefined) done(output);
    return output;
  });
};

window.WAPI.getAllMessageIdsInChat = function(
  id,
  includeMe,
  includeNotifications,
  done
) {
  const chat = WAPI.getChat(id);
  let output = [];
  const messages = chat.msgs._models;

  for (const i in messages) {
    if (
      i === "remove" ||
      (!includeMe && messages[i].isMe) ||
      (!includeNotifications && messages[i].isNotification)
    ) {
      continue;
    }
    output.push(messages[i].id._serialized);
  }
  if (done !== undefined) done(output);
  return output;
};

window.WAPI.getMessageById = function(id, done) {
  let result = false;
  try {
    let msg = window.Store.Msg.get(id);
    if (msg) {
      result = WAPI.processMessageObj(msg, true, true);
    }
  } catch (err) {}

  if (done !== undefined) {
    done(result);
  } else {
    return result;
  }
};

window.WAPI.ReplyMessage = function(idMessage, message, done) {
  var messageObject = window.Store.Msg.get(idMessage);
  if (messageObject === undefined) {
    if (done !== undefined) done(false);
    return false;
  }
  messageObject = messageObject.value();

  const chat = WAPI.getChat(messageObject.chat.id);
  if (chat !== undefined) {
    if (done !== undefined) {
      chat.sendMessage(message, null, messageObject).then(function() {
        function sleep(ms) {
          return new Promise(resolve => setTimeout(resolve, ms));
        }

        var trials = 0;

        function check() {
          for (let i = chat.msgs.models.length - 1; i >= 0; i--) {
            let msg = chat.msgs.models[i];

            if (!msg.senderObj.isMe || msg.body != message) {
              continue;
            }
            done(WAPI._serializeMessageObj(msg));
            return True;
          }
          trials += 1;
          console.log(trials);
          if (trials > 30) {
            done(true);
            return;
          }
          sleep(500).then(check);
        }
        check();
      });
      return true;
    } else {
      chat.sendMessage(message, null, messageObject);
      return true;
    }
  } else {
    if (done !== undefined) done(false);
    return false;
  }
};

window.WAPI.sendMessageToID = function(id, message, done) {
  try {
    window.getContact = id => {
      return Store.WapQuery.queryExist(id);
    };
    window.getContact(id).then(contact => {
      if (contact.status === 404) {
        done(true);
      } else {
        Store.Chat.find(contact.jid)
          .then(chat => {
            chat.sendMessage(message);
            return true;
          })
          .catch(reject => {
            if (WAPI.sendMessage(id, message)) {
              done(true);
              return true;
            } else {
              done(false);
              return false;
            }
          });
      }
    });
  } catch (e) {
    if (window.Store.Chat.length === 0) return false;

    firstChat = Store.Chat.models[0];
    var originalID = firstChat.id;
    firstChat.id =
      typeof originalID === "string"
        ? id
        : new window.Store.UserConstructor(id, {
            intentionallyUsePrivateConstructor: true
          });
    if (done !== undefined) {
      firstChat.sendMessage(message).then(function() {
        firstChat.id = originalID;
        done(true);
      });
      return true;
    } else {
      firstChat.sendMessage(message);
      firstChat.id = originalID;
      return true;
    }
  }
  if (done !== undefined) done(false);
  return false;
};

window.WAPI.sendMessage = sendMessage;
window.WAPI.sendMessage2 = sendMessage2;

window.WAPI.sendSeen = function(id, done) {
  var chat = window.WAPI.getChat(id);
  if (chat !== undefined) {
    if (done !== undefined) {
      Store.SendSeen(chat, false).then(function() {
        done(true);
      });
      return true;
    } else {
      Store.SendSeen(chat, false);
      return true;
    }
  }
  if (done !== undefined) done();
  return false;
};

function isChatMessage(message) {
  if (message.isSentByMe) {
    return false;
  }
  if (message.isNotification) {
    return false;
  }
  if (!message.isUserCreatedType) {
    return false;
  }
  return true;
}

window.WAPI.getUnreadMessages = function(
  includeMe,
  includeNotifications,
  use_unread_count,
  done
) {
  const chats = window.Store.Chat.models;
  let output = [];

  for (let chat in chats) {
    if (isNaN(chat)) {
      continue;
    }

    let messageGroupObj = chats[chat];
    let messageGroup = WAPI._serializeChatObj(messageGroupObj);

    messageGroup.messages = [];

    const messages = messageGroupObj.msgs._models;
    for (let i = messages.length - 1; i >= 0; i--) {
      let messageObj = messages[i];
      if (
        typeof messageObj.isNewMsg != "boolean" ||
        messageObj.isNewMsg === false
      ) {
        continue;
      } else {
        messageObj.isNewMsg = false;
        let message = WAPI.processMessageObj(
          messageObj,
          includeMe,
          includeNotifications
        );
        if (message) {
          messageGroup.messages.push(message);
        }
      }
    }

    if (messageGroup.messages.length > 0) {
      output.push(messageGroup);
    } else {
      // no messages with isNewMsg true
      if (use_unread_count) {
        let n = messageGroupObj.unreadCount; // will use unreadCount attribute to fetch last n messages from sender
        for (let i = messages.length - 1; i >= 0; i--) {
          let messageObj = messages[i];
          if (n > 0) {
            if (!messageObj.isSentByMe) {
              let message = WAPI.processMessageObj(
                messageObj,
                includeMe,
                includeNotifications
              );
              messageGroup.messages.unshift(message);
              n -= 1;
            }
          } else if (n === -1) {
            // chat was marked as unread so will fetch last message as unread
            if (!messageObj.isSentByMe) {
              let message = WAPI.processMessageObj(
                messageObj,
                includeMe,
                includeNotifications
              );
              messageGroup.messages.unshift(message);
              break;
            }
          } else {
            // unreadCount = 0
            break;
          }
        }
        if (messageGroup.messages.length > 0) {
          messageGroupObj.unreadCount = 0; // reset unread counter
          output.push(messageGroup);
        }
      }
    }
  }
  if (done !== undefined) {
    done(output);
  }
  return output;
};

window.WAPI.getGroupOwnerID = async function(id, done) {
  const output = (await WAPI.getGroupMetadata(id)).owner.id;
  if (done !== undefined) {
    done(output);
  }
  return output;
};

window.WAPI.getCommonGroups = async function(id, done) {
  let output = [];

  groups = window.WAPI.getAllGroups();

  for (let idx in groups) {
    try {
      participants = await window.WAPI.getGroupParticipantIDs(groups[idx].id);
      if (participants.filter(participant => participant == id).length) {
        output.push(groups[idx]);
      }
    } catch (err) {
      console.log("Error in group:");
      console.log(groups[idx]);
      console.log(err);
    }
  }

  if (done !== undefined) {
    done(output);
  }
  return output;
};

window.WAPI.getProfilePicSmallFromId = function(id, done) {
  window.Store.ProfilePicThumb.find(id).then(
    function(d) {
      if (d.img !== undefined) {
        window.WAPI.downloadFileWithCredentials(d.img, done);
      } else {
        done(false);
      }
    },
    function(e) {
      done(false);
    }
  );
};

window.WAPI.getProfilePicFromId = function(id, done) {
  window.Store.ProfilePicThumb.find(id).then(
    function(d) {
      if (d.imgFull !== undefined) {
        window.WAPI.downloadFileWithCredentials(d.imgFull, done);
      } else {
        done(false);
      }
    },
    function(e) {
      done(false);
    }
  );
};

window.WAPI.downloadFileWithCredentials = function(url, done) {
  let xhr = new XMLHttpRequest();

  xhr.onload = function() {
    if (xhr.readyState == 4) {
      if (xhr.status == 200) {
        let reader = new FileReader();
        reader.readAsDataURL(xhr.response);
        reader.onload = function(e) {
          done(reader.result.substr(reader.result.indexOf(",") + 1));
        };
      } else {
        console.error(xhr.statusText);
      }
    } else {
      console.log(err);
      done(false);
    }
  };

  xhr.open("GET", url, true);
  xhr.withCredentials = true;
  xhr.responseType = "blob";
  xhr.send(null);
};

window.WAPI.downloadFile = function(url, done) {
  let xhr = new XMLHttpRequest();

  xhr.onload = function() {
    if (xhr.readyState == 4) {
      if (xhr.status == 200) {
        let reader = new FileReader();
        reader.readAsDataURL(xhr.response);
        reader.onload = function(e) {
          done(reader.result.substr(reader.result.indexOf(",") + 1));
        };
      } else {
        console.error(xhr.statusText);
      }
    } else {
      console.log(err);
      done(false);
    }
  };

  xhr.open("GET", url, true);
  xhr.responseType = "blob";
  xhr.send(null);
};

window.WAPI.getBatteryLevel = function(done) {
  if (window.Store.Conn.plugged) {
    if (done !== undefined) {
      done(100);
    }
    return 100;
  }
  output = window.Store.Conn.battery;
  if (done !== undefined) {
    done(output);
  }
  return output;
};

window.WAPI.deleteConversation = function(chatId, done) {
  let userId = new window.Store.UserConstructor(chatId, {
    intentionallyUsePrivateConstructor: true
  });
  let conversation = WAPI.getChat(userId);

  if (!conversation) {
    if (done !== undefined) {
      done(false);
    }
    return false;
  }

  window.Store.sendDelete(conversation, false)
    .then(() => {
      if (done !== undefined) {
        done(true);
      }
    })
    .catch(() => {
      if (done !== undefined) {
        done(false);
      }
    });

  return true;
};

window.WAPI.deleteMessage = function(
  chatId,
  messageArray,
  revoke = false,
  done
) {
  let userId = new window.Store.UserConstructor(chatId, {
    intentionallyUsePrivateConstructor: true
  });
  let conversation = WAPI.getChat(userId);

  if (!conversation) {
    if (done !== undefined) {
      done(false);
    }
    return false;
  }

  if (!Array.isArray(messageArray)) {
    messageArray = [messageArray];
  }

  let messagesToDelete = messageArray.map(msgId => window.Store.Msg.get(msgId));

  if (revoke) {
    conversation.sendRevokeMsgs(messagesToDelete, conversation);
  } else {
    conversation.sendDeleteMsgs(messagesToDelete, conversation);
  }

  if (done !== undefined) {
    done(true);
  }

  return true;
};

window.WAPI.checkNumberStatus = async function(id, done) {
  try {
    const result = await window.Store.WapQuery.queryExist(id);
    if (result.jid === undefined) throw 404;
    const data = window.WAPI._serializeNumberStatusObj(result);
    if (data.status == 200) data.numberExists = true;
    if (done !== undefined) {
      done(window.WAPI._serializeNumberStatusObj(result));
      done(data);
    }
    return data;
  } catch (e) {
    if (done !== undefined) {
      done(
        window.WAPI._serializeNumberStatusObj({
          status: e,
          jid: id
        })
      );
    }
    return e;
  }
};

/**
 * New messages observable functions.
 */
window.WAPI._newMessagesQueue = [];
window.WAPI._newMessagesBuffer =
  sessionStorage.getItem("saved_msgs") != null
    ? JSON.parse(sessionStorage.getItem("saved_msgs"))
    : [];
window.WAPI._newMessagesDebouncer = null;
window.WAPI._newMessagesCallbacks = [];

window.Store.Msg.off("add");
sessionStorage.removeItem("saved_msgs");

window.WAPI._newMessagesListener = window.Store.Msg.on("add", newMessage => {
  if (newMessage && newMessage.isNewMsg && !newMessage.isSentByMe) {
    let message = window.WAPI.processMessageObj(newMessage, false, false);
    if (message) {
      window.WAPI._newMessagesQueue.push(message);
      window.WAPI._newMessagesBuffer.push(message);
    }

    // Starts debouncer time to don't call a callback for each message if more than one message arrives
    // in the same second
    if (
      !window.WAPI._newMessagesDebouncer &&
      window.WAPI._newMessagesQueue.length > 0
    ) {
      window.WAPI._newMessagesDebouncer = setTimeout(() => {
        let queuedMessages = window.WAPI._newMessagesQueue;

        window.WAPI._newMessagesDebouncer = null;
        window.WAPI._newMessagesQueue = [];

        let removeCallbacks = [];

        window.WAPI._newMessagesCallbacks.forEach(function(callbackObj) {
          if (callbackObj.callback !== undefined) {
            callbackObj.callback(queuedMessages);
          }
          if (callbackObj.rmAfterUse === true) {
            removeCallbacks.push(callbackObj);
          }
        });

        // Remove removable callbacks.
        removeCallbacks.forEach(function(rmCallbackObj) {
          let callbackIndex = window.WAPI._newMessagesCallbacks.indexOf(
            rmCallbackObj
          );
          window.WAPI._newMessagesCallbacks.splice(callbackIndex, 1);
        });
      }, 1000);
    }
  }
});

window.WAPI._unloadInform = event => {
  // Save in the buffer the ungot unreaded messages
  window.WAPI._newMessagesBuffer.forEach(message => {
    Object.keys(message).forEach(key =>
      message[key] === undefined ? delete message[key] : ""
    );
  });
  sessionStorage.setItem(
    "saved_msgs",
    JSON.stringify(window.WAPI._newMessagesBuffer)
  );

  // Inform callbacks that the page will be reloaded.
  window.WAPI._newMessagesCallbacks.forEach(function(callbackObj) {
    if (callbackObj.callback !== undefined) {
      callbackObj.callback({
        status: -1,
        message: "page will be reloaded, wait and register callback again."
      });
    }
  });
};

window.addEventListener("unload", window.WAPI._unloadInform, false);
window.addEventListener("beforeunload", window.WAPI._unloadInform, false);
window.addEventListener("pageunload", window.WAPI._unloadInform, false);

/**
 * Registers a callback to be called when a new message arrives the WAPI.
 * @param rmCallbackAfterUse - Boolean - Specify if the callback need to be executed only once
 * @param done - function - Callback function to be called when a new message arrives.
 * @returns {boolean}
 */
window.WAPI.waitNewMessages = function(rmCallbackAfterUse = true, done) {
  window.WAPI._newMessagesCallbacks.push({
    callback: done,
    rmAfterUse: rmCallbackAfterUse
  });
  return true;
};

/**
 * Registers a callback to be called when a the acknowledgement state of the phone connection.
 * @param callback - function - Callback function to be called when the device state changes. this returns 'CONNECTED' or 'TIMEOUT'
 * @returns {boolean}
 */
window.WAPI.onStateChanged = function(callback) {
  window.Store.State.default.on("change:state", callback);
  return true;
};

/**
 * Registers a callback to be called when a the acknowledgement state of a message changes.
 * @param callback - function - Callback function to be called when a message acknowledgement changes.
 * @returns {boolean}
 */
window.WAPI.waitNewAcknowledgements = function(callback) {
  Store.Msg.on("change:ack", callback);
  return true;
};

/**
 * Registers a callback to participant changes on a certain, specific group
 * @param groupId - string - The id of the group that you want to attach the callback to.
 * @param callback - function - Callback function to be called when a message acknowledgement changes. The callback returns 3 variables
 * @returns {boolean}
 */
let groupParticpiantsEvents = {};
window.WAPI.onParticipantsChanged = function(groupId, callback) {
  const chat = window.Store.Chat.get(groupId);
  //attach all group Participants to the events object as 'add'
  const metadata = window.Store.GroupMetadata.get(groupId);
  if (!groupParticpiantsEvents[groupId]) {
    groupParticpiantsEvents[groupId] = {};
    metadata.participants.forEach(participant => {
      groupParticpiantsEvents[groupId][participant.id.toString()] = {
        subtype: "add",
        from: metadata.owner
      };
    });
  }
  let i = 0;
  chat.on("change:groupMetadata.participants", _ =>
    chat.on("all", (x, y) => {
      const { isGroup, previewMessage } = y;
      if (
        isGroup &&
        x === "change" &&
        previewMessage &&
        previewMessage.type === "gp2" &&
        (previewMessage.subtype === "add" ||
          previewMessage.subtype === "remove")
      ) {
        const { subtype, from, recipients } = previewMessage;
        const rec = recipients[0].toString();
        if (
          groupParticpiantsEvents[groupId][rec] &&
          groupParticpiantsEvents[groupId][recipients[0]].subtype == subtype
        ) {
          //ignore, this is a duplicate entry
          // console.log('duplicate event')
        } else {
          //ignore the first message
          if (i == 0) {
            //ignore it, plus 1,
            i++;
          } else {
            groupParticpiantsEvents[groupId][rec] = { subtype, from };
            //fire the callback
            // // previewMessage.from.toString()
            // x removed y
            // x added y
            callback({
              by: from.toString(),
              action: subtype,
              who: recipients
            });
            chat.off("all", this);
            i = 0;
          }
        }
      }
    })
  );
  return true;
};

/**
 * Reads buffered new messages.
 * @param done - function - Callback function to be called contained the buffered messages.
 * @returns {Array}
 */
window.WAPI.getBufferedNewMessages = function(done) {
  let bufferedMessages = window.WAPI._newMessagesBuffer;
  window.WAPI._newMessagesBuffer = [];
  if (done !== undefined) {
    done(bufferedMessages);
  }
  return bufferedMessages;
};
/** End new messages observable functions **/

window.WAPI.sendImage = function(chatid, imgBase64, filename, caption, done) {
  console.log(chatid, filename, caption);
  const idUser = new window.Store.UserConstructor(chatid, {
    intentionallyUsePrivateConstructor: true
  });

  // Create new chat
  return Store.Chat.find(idUser).then(chat => {
    const mediaBlob = window.WAPI.base64ImageToFile(imgBase64, filename);
    const mc = new Store.MediaCollection();
    mc.processFiles([mediaBlob], chat, 1).then(() => {
      var media = mc.models[0];
      media.sendToChat(chat, { caption: caption });
      if (done !== undefined) done(true);
    });
  });
};

window.WAPI.sendVideoAsGif = function(
  imgBase64,
  chatid,
  filename,
  caption,
  done
) {
  //var idUser = new window.Store.UserConstructor(chatid);
  var idUser = new window.Store.UserConstructor(chatid, {
    intentionallyUsePrivateConstructor: true
  });
  // create new chat
  return Store.Chat.find(idUser).then(chat => {
    var mediaBlob = window.WAPI.base64ImageToFile(imgBase64, filename);
    var mc = new Store.MediaCollection();
    mc.processFiles([mediaBlob], chat, 1).then(() => {
      var media = mc.models[0];
      media.mediaPrep._mediaData.isGif = true;
      media.mediaPrep._mediaData.gifAttribution = 1;
      media.mediaPrep.sendToChat(chat, { caption: caption });
      if (done !== undefined) done(true);
    });
  });
};

/**
 * Find any product listings of the given number. Use this to query a catalog
 *
 * @param id id of buseinss profile (i.e the number with @c.us)
 * @param done Optional callback function for async execution
 * @returns None
 */
window.WAPI.getBusinessProfilesProducts = function(id, done) {
  return Store.Catalog.find(id)
    .then(resp => {
      if (resp.msgProductCollection && resp.msgProductCollection._models.length)
        done();
      return resp.productCollection._models;
    })
    .catch(error => {
      done();
      return error.model._products;
    });
};

/**
 * Sends product with image to chat
 * @param imgBase64 Base64 image data
 * @param chatid string the id of the chat that you want to send this product to
 * @param caption string the caption you want to add to this message
 * @param bizNumber string the @c.us number of the business account from which you want to grab the product
 * @param productId string the id of the product within the main catalog of the aforementioned business
 * @param done - function - Callback function to be called contained the buffered messages.
 * @returns
 */
window.WAPI.sendImageWithProduct = function(
  imgBase64,
  chatid,
  caption,
  bizNumber,
  productId,
  done
) {
  Store.Catalog.findCarouselCatalog(bizNumber).then(cat => {
    if (cat && cat[0]) {
      const product = cat[0].productCollection.get(productId);
      const temp = {
        productMsgOptions: {
          businessOwnerJid: product.catalogWid.toString({
            legacy: !0
          }),
          productId: product.id.toString(),
          url: product.url,
          productImageCount: product.productImageCollection.length,
          title: product.name,
          description: product.description,
          currencyCode: product.currency,
          priceAmount1000: product.priceAmount1000,
          type: "product"
        },
        caption
      };

      var idUser = new window.Store.UserConstructor(chatid, {
        intentionallyUsePrivateConstructor: true
      });

      return Store.Chat.find(idUser).then(chat => {
        var mediaBlob = window.WAPI.base64ImageToFile(imgBase64, filename);
        var mc = new Store.MediaCollection();
        mc.processFiles([mediaBlob], chat, 1).then(() => {
          var media = mc.models[0];
          Object.entries(temp.productMsgOptions).map(
            ([k, v]) => (media.mediaPrep._mediaData[k] = v)
          );
          media.mediaPrep.sendToChat(chat, temp);
          if (done !== undefined) done(true);
        });
      });
    }
  });
};

window.WAPI.base64ImageToFile = function(b64Data, filename) {
  var arr = b64Data.split(",");
  var mime = arr[0].match(/:(.*?);/)[1];
  var bstr = atob(arr[1]);
  var n = bstr.length;
  var u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
};

/**
 * Send contact card to a specific chat using the chat ids
 *
 * @param {string} to '000000000000@c.us'
 * @param {string|array} contact '111111111111@c.us' | ['222222222222@c.us', '333333333333@c.us, ... 'nnnnnnnnnnnn@c.us']
 */
window.WAPI.sendContact = function(to, contact) {
  if (!Array.isArray(contact)) {
    contact = [contact];
  }
  contact = contact.map(c => {
    return WAPI.getChat(c).__x_contact;
  });

  if (contact.length > 1) {
    window.WAPI.getChat(to).sendContactList(contact);
  } else if (contact.length === 1) {
    window.WAPI.getChat(to).sendContact(contact[0]);
  }
};

/**
 * Forward an array of messages to a specific chat using the message ids or Objects
 *
 * @param {string} to '000000000000@c.us'
 * @param {string|array[Message | string]} messages this can be any mixture of message ids or message objects
 * @param {boolean} skipMyMessages This indicates whether or not to skip your own messages from the array
 */
window.WAPI.forwardMessages = async function(to, messages, skipMyMessages) {
  if (!Array.isArray(messages)) {
    messages = [messages];
  }
  const finalForwardMessages = messages
    .map(msg => {
      if (typeof msg == "string") {
        //msg is string, get the message object
        return window.Store.Msg.get(msg);
      } else {
        return window.Store.Msg.get(msg.id);
      }
    })
    .filter(msg => (skipMyMessages ? !msg.__x_isSentByMe : true));

  // let userId = new window.Store.UserConstructor(to);
  let conversation = window.Store.Chat.get(to);
  return await conversation.forwardMessages(finalForwardMessages);
};

/**
 * Create an chat ID based in a cloned one
 *
 * @param {string} chatId '000000000000@c.us'
 */
window.WAPI.getNewMessageId = function(chatId) {
  var newMsgId = Store.Msg.models[0].__x_id.clone();

  newMsgId.fromMe = true;
  newMsgId.id = WAPI.getNewId().toUpperCase();
  newMsgId.remote = chatId;
  newMsgId._serialized = `${newMsgId.fromMe}_${newMsgId.remote}_${newMsgId.id}`;

  return newMsgId;
};

/**
 * Simulate '...typing' in the chat.
 *
 * @param {string} chatId '000000000000@c.us'
 * @param {boolean} on true to turn on similated typing, false to turn it off //you need to manually turn this off.
 */
window.WAPI.simulateTyping = async function(chatId, on) {
  if (on) await Store.WapQuery.sendChatstateComposing(chatId);
  else await Store.WapQuery.sendChatstateComposing(chatId);
};

/**
 * Send location
 *
 * @param {string} chatId '000000000000@c.us'
 * @param {string} lat latitude
 * @param {string} lng longitude
 * @param {string} loc Text to go with the location message
 */
window.WAPI.sendLocation = async function(chatId, latitude, longitude, caption) {
  var chat = Store.Chat.get(chatId);
  var tempMsg = Object.create(chat.msgs.filter(msg => msg.__x_isSentByMe)[0]);
  var newId = window.WAPI.getNewMessageId(chatId);
  var extend = {
    ack: 0,
    id: newId,
    local: true,
    self: "out",
    t: parseInt(new Date().getTime() / 1000),
    to: chatId,
    isNewMsg: true,
    type: "location",
    lat: latitude,
    lng: longitude,
    loc: caption
  };

  Object.assign(tempMsg, extend);

  console.log(chat);
  console.log(tempMsg);
  await Store.addAndSendMsgToChat(chat, tempMsg);
};

/**
 * Send Payment Request
 *
 * @param {string} chatId '000000000000@c.us'
 * @param {string} amount1000 The amount in base value / 10 (e.g 50000 in GBP = £50)
 * @param {string} currency Three letter currency code (e.g SAR, GBP, USD, INR, AED, EUR)
 * @param {string} note message to send with the payment request
 */
window.WAPI.sendPaymentRequest = async function(
  chatId,
  amount1000,
  currency,
  noteMessage
) {
  var chat = Store.Chat.get(chatId);
  var tempMsg = Object.create(chat.msgs.filter(msg => msg.__x_isSentByMe)[0]);
  var newId = window.WAPI.getNewMessageId(chatId);
  var extend = {
    ack: 0,
    id: newId,
    local: !0,
    self: "out",
    t: parseInt(new Date().getTime() / 1000),
    to: chatId,
    isNewMsg: !0,
    type: "payment",
    subtype: "request",
    amount1000,
    requestFrom: chatId,
    currency,
    noteMessage,
    expiryTimestamp: parseInt(
      new Date(new Date().setDate(new Date().getDate() + 1)).getTime() / 1000
    )
  };
  Object.assign(tempMsg, extend);
  await Store.addAndSendMsgToChat(chat, tempMsg);
};

/**
 * Send Customized VCard without the necessity of contact be a Whatsapp Contact
 *
 * @param {string} chatId '000000000000@c.us'
 * @param {object|array} vcard { displayName: 'Contact Name', vcard: 'BEGIN:VCARD\nVERSION:3.0\nN:;Contact Name;;;\nEND:VCARD' } | [{ displayName: 'Contact Name 1', vcard: 'BEGIN:VCARD\nVERSION:3.0\nN:;Contact Name 1;;;\nEND:VCARD' }, { displayName: 'Contact Name 2', vcard: 'BEGIN:VCARD\nVERSION:3.0\nN:;Contact Name 2;;;\nEND:VCARD' }]
 */
window.WAPI.sendVCard = function(chatId, vcard) {
  var chat = Store.Chat.get(chatId);
  var tempMsg = Object.create(
    Store.Msg.models.filter(msg => msg.__x_isSentByMe)[0]
  );
  var newId = window.WAPI.getNewMessageId(chatId);

  var extend = {
    ack: 0,
    id: newId,
    local: !0,
    self: "out",
    t: parseInt(new Date().getTime() / 1000),
    to: chatId,
    isNewMsg: !0
  };

  if (Array.isArray(vcard)) {
    Object.assign(extend, {
      type: "multi_vcard",
      vcardList: vcard
    });

    delete extend.body;
  } else {
    Object.assign(extend, {
      type: "vcard",
      subtype: vcard.displayName,
      body: vcard.vcard
    });

    delete extend.vcardList;
  }

  Object.assign(tempMsg, extend);

  Store.addAndSendMsgToChat(chat, tempMsg);
};
/**
 * Block contact
 * @param {string} id '000000000000@c.us'
 * @param {*} done - function - Callback function to be called when a new message arrives.
 */
window.WAPI.contactBlock = function(id, done) {
  const contact = window.Store.Contact.get(id);
  if (contact !== undefined) {
    contact.setBlock(!0);
    done(true);
    return true;
  }
  done(false);
  return false;
};
/**
 * unBlock contact
 * @param {string} id '000000000000@c.us'
 * @param {*} done - function - Callback function to be called when a new message arrives.
 */
window.WAPI.contactUnblock = function(id, done) {
  const contact = window.Store.Contact.get(id);
  if (contact !== undefined) {
    contact.setBlock(!1);
    done(true);
    return true;
  }
  done(false);
  return false;
};

/**
 * Remove participant of Group
 * @param {*} idGroup '0000000000-00000000@g.us'
 * @param {*} idParticipant '000000000000@c.us'
 * @param {*} done - function - Callback function to be called when a new message arrives.
 */
window.WAPI.removeParticipantGroup = function(idGroup, idParticipant, done) {
  window.Store.WapQuery.removeParticipants(idGroup, [idParticipant]).then(
    () => {
      const metaDataGroup = window.Store.GroupMetadata.get(id);
      checkParticipant = metaDataGroup.participants._index[idParticipant];
      if (checkParticipant === undefined) {
        done(true);
        return true;
      }
    }
  );
};

/**
 * Promote Participant to Admin in Group
 * @param {*} idGroup '0000000000-00000000@g.us'
 * @param {*} idParticipant '000000000000@c.us'
 * @param {*} done - function - Callback function to be called when a new message arrives.
 */
window.WAPI.promoteParticipantAdminGroup = function(
  idGroup,
  idParticipant,
  done
) {
  window.Store.WapQuery.promoteParticipants(idGroup, [idParticipant]).then(
    () => {
      const metaDataGroup = window.Store.GroupMetadata.get(id);
      checkParticipant = metaDataGroup.participants._index[idParticipant];
      if (checkParticipant !== undefined && checkParticipant.isAdmin) {
        done(true);
        return true;
      }
      done(false);
      return false;
    }
  );
};

/**
 * Demote Admin of Group
 * @param {*} idGroup '0000000000-00000000@g.us'
 * @param {*} idParticipant '000000000000@c.us'
 * @param {*} done - function - Callback function to be called when a new message arrives.
 */
window.WAPI.demoteParticipantAdminGroup = function(
  idGroup,
  idParticipant,
  done
) {
  window.Store.WapQuery.demoteParticipants(idGroup, [idParticipant]).then(
    () => {
      const metaDataGroup = window.Store.GroupMetadata.get(id);
      if (metaDataGroup === undefined) {
        done(false);
        return false;
      }
      checkParticipant = metaDataGroup.participants._index[idParticipant];
      if (checkParticipant !== undefined && checkParticipant.isAdmin) {
        done(false);
        return false;
      }
      done(true);
      return true;
    }
  );
};