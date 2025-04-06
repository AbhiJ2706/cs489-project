export default {
  "$files": {
    "bind": [
      "isOwner",
      "auth.id in data.ref('creator.id')",
      "isAnonymous",
      "auth.id == null",
      "isSignedIn",
      "auth.id != null",
      "isAdmin",
      "auth.email in ['edenchan717@gmail.com', 'kenson.hui22@gmail.com']",
      "isCreatedByAnonymous",
      "size(data.ref('creator.id')) == 0"
    ],
    "allow": {
      "view": "true",
      "create": "true",
      "delete": "isOwner || isCreatedByAnonymous",
      "update": "false"
    }
  }
};