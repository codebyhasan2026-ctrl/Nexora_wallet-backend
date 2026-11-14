const SiteSetting = require("../models/siteSetting");
const { uploadToCloudinary } = require("../middleware/upload");

exports.getSiteSettings = async (req, res) => {
  try {
    let settings = await SiteSetting.findOne();
    if (!settings) {
      settings = await SiteSetting.create({
        siteName: "Nexora Wallet",
        siteLogo: "/logo.jpg",
        description: "Smart Financial Platform",
      });
    }

    return res.status(200).json({
      success: true,
      settings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve site settings",
    });
  }
};

exports.updateSiteLogo = async (req, res) => {
  try {
    let logoUrl = "";

    if (req.file) {
      logoUrl = await uploadToCloudinary(req.file.buffer);
    } else if (req.body?.siteLogo) {
      logoUrl = req.body.siteLogo.trim();
    } else {
      return res.status(400).json({
        success: false,
        message: "No logo image file or URL provided",
      });
    }

    let settings = await SiteSetting.findOne();
    if (!settings) {
      settings = new SiteSetting({
        siteName: "Nexora Wallet",
        siteLogo: logoUrl,
      });
    } else {
      settings.siteLogo = logoUrl;
    }

    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Site logo updated successfully",
      settings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to update site logo",
    });
  }
};

exports.updateSiteSettings = async (req, res) => {
  try {
    let settings = await SiteSetting.findOne();
    if (!settings) {
      settings = new SiteSetting();
    }

    const updatableFields = [
      "siteName",
      "siteLogo",
      "description",
      "telegramChannel",
      "telegramGroup",
      "whatsappNumber",
      "facebookPage",
      "youtubeTutorial",
      "supportEmail",
      "contactImage",
      "bkashNumber",
      "nagadNumber",
      "depositNotice",
      "minDeposit",
      "maxDeposit",
      "minWithdraw",
      "maxWithdraw",
      "withdrawFeePercent",
      "commissionLevel1",
      "commissionLevel2",
      "commissionLevel3",
      "announcementNotice",
      "homeMarqueeNotice",
      "homeMarqueeActive",
      "popupActive",
      "popupTitle",
      "popupMessage",
      "popupImage",
      "popupButtonText",
      "popupButtonLink",
      "currency",
      "currencySymbol",
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        settings[field] = req.body[field];
      }
    });

    if (req.body.currency !== undefined) {
      settings.currency = req.body.currency === "BDT" ? "BDT" : "USDT";
      settings.currencySymbol = settings.currency === "BDT" ? "৳" : "$";
    }

    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      settings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update site settings",
    });
  }
};

exports.uploadPopupImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No popup image file provided",
      });
    }

    const imageUrl = await uploadToCloudinary(req.file.buffer);

    let settings = await SiteSetting.findOne();
    if (!settings) {
      settings = new SiteSetting();
    }

    settings.popupImage = imageUrl;
    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Popup image uploaded successfully",
      popupImage: imageUrl,
      settings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to upload popup image",
    });
  }
};

exports.uploadContactImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No contact image file provided",
      });
    }

    const imageUrl = await uploadToCloudinary(req.file.buffer);

    let settings = await SiteSetting.findOne();
    if (!settings) {
      settings = new SiteSetting();
    }

    settings.contactImage = imageUrl;
    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Contact image uploaded successfully",
      contactImage: imageUrl,
      settings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to upload contact image",
    });
  }
};
