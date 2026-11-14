const mongoose = require("mongoose");

const siteSettingSchema = new mongoose.Schema(
  {
    siteName: {
      type: String,
      default: "Nexora Wallet",
      trim: true,
    },
    siteLogo: {
      type: String,
      default: "/logo.jpg",
      trim: true,
    },
    description: {
      type: String,
      default: "Smart Financial Platform",
    },
    telegramChannel: {
      type: String,
      default: "https://t.me/nexorawallet",
      trim: true,
    },
    telegramGroup: {
      type: String,
      default: "https://t.me/nexorawallet_group",
      trim: true,
    },
    whatsappNumber: {
      type: String,
      default: "+8801700000000",
      trim: true,
    },
    facebookPage: {
      type: String,
      default: "",
      trim: true,
    },
    youtubeTutorial: {
      type: String,
      default: "",
      trim: true,
    },
    supportEmail: {
      type: String,
      default: "support@nexora.io",
      trim: true,
    },
    contactImage: {
      type: String,
      default: "/support-agent.jpg",
      trim: true,
    },
    bkashNumber: {
      type: String,
      default: "01316429565",
      trim: true,
    },
    nagadNumber: {
      type: String,
      default: "01316429565",
      trim: true,
    },
    depositNotice: {
      type: String,
      default: "Send Money via bKash/Nagad and submit Transaction ID.",
    },
    minDeposit: {
      type: Number,
      default: 200,
    },
    maxDeposit: {
      type: Number,
      default: 50000,
    },
    minWithdraw: {
      type: Number,
      default: 300,
    },
    maxWithdraw: {
      type: Number,
      default: 50000,
    },
    withdrawFeePercent: {
      type: Number,
      default: 0,
    },
    commissionLevel1: {
      type: Number,
      default: 10,
    },
    commissionLevel2: {
      type: Number,
      default: 5,
    },
    commissionLevel3: {
      type: Number,
      default: 2,
    },
    announcementNotice: {
      type: String,
      default: "Welcome to Nexora Wallet. Safe & Reliable Daily Financial Platform.",
    },
    homeMarqueeNotice: {
      type: String,
      default: "This Website Develop by : Nexora Wallet • Daily Ads Earning & High ROI Investment Platform • Watch Ads & Earn USDT",
    },
    homeMarqueeActive: {
      type: Boolean,
      default: true,
    },
    popupActive: {
      type: Boolean,
      default: false,
    },
    popupTitle: {
      type: String,
      default: "Special Notice",
    },
    popupMessage: {
      type: String,
      default: "Welcome to Nexora Wallet! Watch daily ads & earn USDT with high returns.",
    },
    popupImage: {
      type: String,
      default: "",
    },
    popupButtonText: {
      type: String,
      default: "Explore Plans",
    },
    popupButtonLink: {
      type: String,
      default: "/plans",
    },
    currency: {
      type: String,
      enum: ["USDT", "BDT"],
      default: "USDT",
    },
    currencySymbol: {
      type: String,
      default: "$",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SiteSetting", siteSettingSchema);