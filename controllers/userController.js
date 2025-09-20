const User = require("../models/userModel");

// const socketHandler = require('../socket');
// const comment = require('../models/commentModel');
const sendEmail = require('../utils/email')


exports.uploadfilePic = async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { profilePic: req.file?.path },
      { new: true, runValidators: false } // disable validators for missing fields
    );

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

     // 🔔 Emit a notification to all connected clients
        // ✅ Emit real-time notification
    // const io = socketHandler();
    // io.emit("activity", {
    //   type: "PROFILE_UPDATE",
    //   message: `${updatedUser.name} updated their profile picture`,
    //   timestamp: new Date(),
    // });


    // ✅ Send email notification to user
    if (updatedUser.email){
    await sendEmail({
      email: updatedUser.email,
      subject: "Profile Picture Updated",
      message: `Hi ${updatedUser.name},\n\nYour profile picture has been successfully updated.\n\n- Project Tracker Team`,
    });
  }
    const admins = await User.find({role:"admin"});
    const adminEmails = admins.map(admin => admin.email);
    // ✅ Send email notification to admin
    if (adminEmails.length > 0){
    await sendEmail({
      email: adminEmails,
      subject: "User Activity Notification",
      message: `User ${updatedUser.name} (ID: ${updatedUser._id}) updated their profile picture.`,
    });
  }
   res.status(201).render("signup-success", {
      title: "Profile picture updated",
      message: "Your Profile picture updated successfully!.",
    });
    // res.json({
    //   message: "Profile picture updated",
    //   profilePic: updatedUser.profilePic,
    // });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}




exports.updateFieldByEmail= async(req,res) =>{
  try {
    const updatedUser = await User.findOneAndUpdate(
  { email: req.body.email },
  { [req.body.field]: req.body.value },
  { new: true, runValidators: false }
);

    if (!updatedUser) {
       res.status(201).render("signup-success", {
      title: "Profile updated",
      message: "Your Profile updated successfully!.",
    });
    }

     res.status(201).render("signup-success", {
      title: "Profile updated",
      message: "Your Profile updated successfully!.",
    });
  } catch (err) {
    console.error("Error updating user:", err.message);
    throw err;
  }
}

