const express = require("express");
const router = express.Router();
const lotteryController = require("../controllers/lotteryController");
const userAuth = require("../middleware/userAuth");
const adminAuth = require("../middleware/adminAuth");
const { upload } = require("../middleware/upload");

router.get("/active", lotteryController.getActiveLotteries);
router.get("/results", lotteryController.getLotteryResults);
router.get("/details/:id", lotteryController.getLotteryById);
router.post("/buy", userAuth, lotteryController.buyTickets);
router.get("/my-tickets", userAuth, lotteryController.getMyTickets);

router.get("/admin/all", adminAuth, lotteryController.getAllLotteriesAdmin);
router.post(
  "/admin/create",
  adminAuth,
  upload.single("image"),
  lotteryController.createLotteryAdmin
);
router.put(
  "/admin/update/:id",
  adminAuth,
  upload.single("image"),
  lotteryController.updateLotteryAdmin
);
router.delete("/admin/delete/:id", adminAuth, lotteryController.deleteLotteryAdmin);
router.get("/admin/tickets/:id", adminAuth, lotteryController.getLotteryTicketsAdmin);
router.post("/admin/draw/:id", adminAuth, lotteryController.drawLotteryAdmin);

module.exports = router;

