const PaymentGateway = require("../models/paymentGateway");
const SiteSetting = require("../models/siteSetting");
const { uploadToCloudinary } = require("../middleware/upload");

const seedDefaultGatewaysIfNeeded = async () => {
  const count = await PaymentGateway.countDocuments();
  if (count === 0) {
    const settings = await SiteSetting.findOne();
    const bkashNum = settings?.bkashNumber || "01316429565";
    const nagadNum = settings?.nagadNumber || "01316429565";
    const notice = settings?.depositNotice || "Send Money to this number and submit TrxID.";

    await PaymentGateway.create([
      {
        name: "bKash",
        gatewayType: "Personal / Send Money",
        number: bkashNum,
        image: "/bkash.png",
        instruction: `Dial *247# or use bKash App. Select "Send Money" to ${bkashNum} and submit Transaction ID.`,
        minDeposit: 200,
        maxDeposit: 50000,
        isActive: true,
      },
      {
        name: "Nagad",
        gatewayType: "Personal / Send Money",
        number: nagadNum,
        image: "/nagad.png",
        instruction: `Dial *167# or use Nagad App. Select "Send Money" to ${nagadNum} and submit Transaction ID.`,
        minDeposit: 200,
        maxDeposit: 50000,
        isActive: true,
      },
    ]);
  }
};

exports.getActiveGateways = async (req, res) => {
  try {
    await seedDefaultGatewaysIfNeeded();
    const gateways = await PaymentGateway.find({ isActive: true })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      gateways,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment gateways",
    });
  }
};

exports.getAllGatewaysAdmin = async (req, res) => {
  try {
    await seedDefaultGatewaysIfNeeded();
    const gateways = await PaymentGateway.find().sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      gateways,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment gateways",
    });
  }
};

exports.createGatewayAdmin = async (req, res) => {
  try {
    const {
      name,
      gatewayType,
      number,
      instruction,
      minDeposit,
      maxDeposit,
      isActive,
      image,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Gateway name is required",
      });
    }

    if (!number || !number.trim()) {
      return res.status(400).json({
        success: false,
        message: "Account number or wallet address is required",
      });
    }

    let imageUrl = image ? image.trim() : "";
    if (req.file) {
      try {
        imageUrl = await uploadToCloudinary(req.file.buffer);
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload gateway logo image",
        });
      }
    }

    const newGateway = await PaymentGateway.create({
      name: name.trim(),
      gatewayType: (gatewayType || "Personal").trim(),
      number: number.trim(),
      image: imageUrl,
      instruction: instruction ? instruction.trim() : "",
      minDeposit: Number(minDeposit) || 200,
      maxDeposit: Number(maxDeposit) || 50000,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    return res.status(201).json({
      success: true,
      message: "Payment gateway created successfully",
      gateway: newGateway,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to create payment gateway",
    });
  }
};

exports.updateGatewayAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const gateway = await PaymentGateway.findById(id);

    if (!gateway) {
      return res.status(404).json({
        success: false,
        message: "Payment gateway not found",
      });
    }

    const {
      name,
      gatewayType,
      number,
      instruction,
      minDeposit,
      maxDeposit,
      isActive,
      image,
    } = req.body;

    if (name !== undefined) gateway.name = name.trim();
    if (gatewayType !== undefined) gateway.gatewayType = gatewayType.trim();
    if (number !== undefined) gateway.number = number.trim();
    if (instruction !== undefined) gateway.instruction = instruction.trim();
    if (minDeposit !== undefined) gateway.minDeposit = Number(minDeposit) || 200;
    if (maxDeposit !== undefined) gateway.maxDeposit = Number(maxDeposit) || 50000;
    if (isActive !== undefined) gateway.isActive = Boolean(isActive);

    if (req.file) {
      try {
        gateway.image = await uploadToCloudinary(req.file.buffer);
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload gateway logo image",
        });
      }
    } else if (image !== undefined) {
      gateway.image = image.trim();
    }

    await gateway.save();

    return res.status(200).json({
      success: true,
      message: "Payment gateway updated successfully",
      gateway,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to update payment gateway",
    });
  }
};

exports.deleteGatewayAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await PaymentGateway.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Payment gateway not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment gateway deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete payment gateway",
    });
  }
};

