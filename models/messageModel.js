const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true, // room could be private roomId or groupId
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "chatUser",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "chatUser",
      },
    ],
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;
