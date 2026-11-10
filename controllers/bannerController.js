const Banner = require("../models/banner");
const { uploadToCloudinary } = require("../middleware/upload");

const defaultBanners = [
  {
    title: "Global Investment Growth",
    subtitle: "High yield automated daily returns",
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800",
    link: "/plans",
    order: 1,
    isActive: true,
  },
  {
    title: "Sponsored Ads Network",
    subtitle: "Watch daily ads and receive instant USDT",
    image: "https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800",
    link: "/task",
    order: 2,
    isActive: true,
  },
  {
    title: "Instant Crypto Payouts",
    subtitle: "Secure bKash & Nagad withdrawal gateway",
    image: "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=800",
    link: "/withdraw",
    order: 3,
    isActive: true,
  },
];

const seedDefaultBannersIfNeeded = async () => {
  const count = await Banner.countDocuments();
  if (count === 0) {
    await Banner.insertMany(defaultBanners);
  }
};

exports.getActiveBanners = async (req, res) => {
  try {
    await seedDefaultBannersIfNeeded();
    const banners = await Banner.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      banners,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active banners",
    });
  }
};

exports.getAllBannersAdmin = async (req, res) => {
  try {
    await seedDefaultBannersIfNeeded();
    const banners = await Banner.find()
      .sort({ order: 1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      banners,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
    });
  }
};

exports.createBannerAdmin = async (req, res) => {
  try {
    const { title, subtitle, imageUrl, link, order, isActive } = req.body;

    let bannerImage = imageUrl ? imageUrl.trim() : "";

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, "banners");
      bannerImage = uploadResult.secure_url;
    }

    if (!bannerImage) {
      return res.status(400).json({
        success: false,
        message: "Banner image is required (upload file or provide image URL)",
      });
    }

    const banner = await Banner.create({
      title: title ? title.trim() : "",
      subtitle: subtitle ? subtitle.trim() : "",
      image: bannerImage,
      link: link ? link.trim() : "",
      order: Number(order) || 0,
      isActive: isActive === "false" || isActive === false ? false : true,
    });

    return res.status(201).json({
      success: true,
      message: "Banner created successfully",
      banner,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create banner",
    });
  }
};

exports.updateBannerAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, imageUrl, link, order, isActive } = req.body;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, "banners");
      banner.image = uploadResult.secure_url;
    } else if (imageUrl && imageUrl.trim()) {
      banner.image = imageUrl.trim();
    }

    if (title !== undefined) banner.title = title.trim();
    if (subtitle !== undefined) banner.subtitle = subtitle.trim();
    if (link !== undefined) banner.link = link.trim();
    if (order !== undefined) banner.order = Number(order) || 0;
    if (isActive !== undefined) {
      banner.isActive = isActive === "true" || isActive === true;
    }

    await banner.save();

    return res.status(200).json({
      success: true,
      message: "Banner updated successfully",
      banner,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update banner",
    });
  }
};

exports.deleteBannerAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Banner.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete banner",
    });
  }
};

exports.toggleBannerStatusAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    banner.isActive = !banner.isActive;
    await banner.save();

    return res.status(200).json({
      success: true,
      message: `Banner ${banner.isActive ? "activated" : "deactivated"} successfully`,
      banner,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to toggle banner status",
    });
  }
};
