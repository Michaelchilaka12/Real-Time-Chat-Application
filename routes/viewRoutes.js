const express = require("express");
const router = express.Router();
const authController = require('../controllers/authController');



//public pages 
router.get("/signup",authController.renderSignup);
router.get("/login", authController.renderLogin);
router.get("/chat",authController.isLoggedIn,authController.renderChat)
router.get("/profilePic",authController.isLoggedIn,authController.renderProfile)
router.get("/update",authController.isLoggedIn,authController.renderUpdate)



module.exports = router;