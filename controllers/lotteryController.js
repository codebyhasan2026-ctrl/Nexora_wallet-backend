const mongoose = require("mongoose");
const Lottery = require("../models/lottery");
const LotteryTicket = require("../models/lotteryTicket");
const User = require("../models/user");
const Notification = require("../models/notification");
const { uploadToCloudinary } = require("../middleware/upload");

const seedDefaultLotteriesIfNeeded = async () => {
  const count = await Lottery.countDocuments();
  if (count === 0) {
    const futureDate1 = new Date();
    futureDate1.setDate(futureDate1.getDate() + 7);

    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 14);

    await Lottery.create([
      {
        title: "Nexora Weekly Bumper Cash Draw",
        description: "Win up to ৳25,000 cash prize directly credited to your wallet balance!",
        image: "/lottery-cash.svg",
        ticketPrice: 50,
        totalTickets: 1000,
        soldTicketsCount: 0,
        drawDate: futureDate1,
        status: "active",
        prizes: [
          {
            rank: 1,
            name: "1st Prize",
            rewardType: "cash",
            rewardAmount: 15000,
            productTitle: "",
          },
          {
            rank: 2,
            name: "2nd Prize",
            rewardType: "cash",
            rewardAmount: 7000,
            productTitle: "",
          },
          {
            rank: 3,
            name: "3rd Prize",
            rewardType: "cash",
            rewardAmount: 3000,
            productTitle: "",
          },
        ],
        isActive: true,
      },
      {
        title: "Grand Tech & Gadget Mega Draw",
        description: "Win brand new flagship devices like iPhone 16 Pro Max and Cash bonuses!",
        image: "/lottery-gift.svg",
        ticketPrice: 100,
        totalTickets: 500,
        soldTicketsCount: 0,
        drawDate: futureDate2,
        status: "active",
        prizes: [
          {
            rank: 1,
            name: "1st Prize",
            rewardType: "product",
            rewardAmount: 0,
            productTitle: "Apple iPhone 16 Pro Max (256GB)",
          },
          {
            rank: 2,
            name: "2nd Prize",
            rewardType: "product",
            rewardAmount: 0,
            productTitle: "Samsung Galaxy Watch Ultra",
          },
          {
            rank: 3,
            name: "3rd Prize",
            rewardType: "cash",
            rewardAmount: 5000,
            productTitle: "",
          },
        ],
        isActive: true,
      },
    ]);
  }
};

exports.getActiveLotteries = async (req, res) => {
  try {
    await seedDefaultLotteriesIfNeeded();
    const lotteries = await Lottery.find({ status: "active", isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, lotteries });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLotteryById = async (req, res) => {
  try {
    const { id } = req.params;
    const lottery = await Lottery.findById(id)
      .populate("prizes.winnerUser", "name phone email")
      .lean();

    if (!lottery) {
      return res.status(404).json({ success: false, message: "Lottery not found" });
    }

    return res.status(200).json({ success: true, lottery });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.buyTickets = async (req, res) => {
  try {
    const userId = req.user._id;
    const { lotteryId, quantity } = req.body;

    const numTickets = Math.max(1, parseInt(quantity, 10) || 1);

    if (!lotteryId || !mongoose.isValidObjectId(lotteryId)) {
      return res.status(400).json({ success: false, message: "Valid lottery ID is required" });
    }

    const lottery = await Lottery.findById(lotteryId);
    if (!lottery || lottery.status !== "active" || !lottery.isActive) {
      return res.status(400).json({ success: false, message: "This lottery is not active for ticket purchase" });
    }

    if (lottery.totalTickets > 0 && lottery.soldTicketsCount + numTickets > lottery.totalTickets) {
      const remaining = Math.max(0, lottery.totalTickets - lottery.soldTicketsCount);
      return res.status(400).json({
        success: false,
        message: `Only ${remaining} ticket(s) remaining for this lottery!`,
      });
    }

    const totalCost = Number((lottery.ticketPrice * numTickets).toFixed(2));

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (Number(user.balance) < totalCost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance! You need ৳${totalCost.toFixed(2)} to buy ${numTickets} ticket(s).`,
      });
    }

    user.balance = Number((user.balance - totalCost).toFixed(2));
    await user.save();

    const existingTicketsCount = await LotteryTicket.countDocuments({ lottery: lottery._id });
    const ticketsToInsert = [];
    const generatedTicketNumbers = [];

    for (let i = 0; i < numTickets; i++) {
      const ticketSeq = existingTicketsCount + i + 1;
      const randomPart = Math.floor(1000 + Math.random() * 9000);
      const ticketNumber = `LOT-${ticketSeq}-${randomPart}`;
      generatedTicketNumbers.push(ticketNumber);

      ticketsToInsert.push({
        lottery: lottery._id,
        user: userId,
        ticketNumber,
        purchasePrice: lottery.ticketPrice,
      });
    }

    await LotteryTicket.insertMany(ticketsToInsert);

    lottery.soldTicketsCount = (lottery.soldTicketsCount || 0) + numTickets;
    await lottery.save();

    return res.status(200).json({
      success: true,
      message: `Successfully purchased ${numTickets} ticket(s) for ৳${totalCost.toFixed(2)}!`,
      tickets: generatedTicketNumbers,
      remainingBalance: user.balance,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyTickets = async (req, res) => {
  try {
    const userId = req.user._id;
    const { lotteryId } = req.query;

    const filter = { user: userId };
    if (lotteryId && mongoose.isValidObjectId(lotteryId)) {
      filter.lottery = lotteryId;
    }

    const tickets = await LotteryTicket.find(filter)
      .populate("lottery", "title image drawDate status ticketPrice prizes")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, tickets });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLotteryResults = async (req, res) => {
  try {
    const drawnLotteries = await Lottery.find({ status: "drawn" })
      .populate("prizes.winnerUser", "name phone")
      .sort({ drawnAt: -1 })
      .lean();

    return res.status(200).json({ success: true, results: drawnLotteries });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllLotteriesAdmin = async (req, res) => {
  try {
    await seedDefaultLotteriesIfNeeded();
    const lotteries = await Lottery.find()
      .populate("prizes.winnerUser", "name phone email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, lotteries });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createLotteryAdmin = async (req, res) => {
  try {
    const {
      title,
      description,
      image,
      ticketPrice,
      totalTickets,
      drawDate,
      prizes,
      isActive,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Lottery title is required" });
    }

    const numPrice = Number(ticketPrice);
    if (isNaN(numPrice) || numPrice <= 0) {
      return res.status(400).json({ success: false, message: "Valid ticket price is required" });
    }

    if (!drawDate) {
      return res.status(400).json({ success: false, message: "Draw date is required" });
    }

    let parsedPrizes = [];
    if (typeof prizes === "string") {
      try {
        parsedPrizes = JSON.parse(prizes);
      } catch (e) {
        parsedPrizes = [];
      }
    } else if (Array.isArray(prizes)) {
      parsedPrizes = prizes;
    }

    let imageUrl = image ? image.trim() : "/lottery-cash.svg";
    if (req.file) {
      try {
        imageUrl = await uploadToCloudinary(req.file.buffer);
      } catch (err) {
        imageUrl = "/lottery-cash.svg";
      }
    }

    const formattedPrizes = parsedPrizes.map((p, idx) => ({
      rank: p.rank || idx + 1,
      name: p.name || `${idx + 1}${idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th"} Prize`,
      rewardType: p.rewardType === "product" ? "product" : "cash",
      rewardAmount: Number(p.rewardAmount) || 0,
      productTitle: p.productTitle ? p.productTitle.trim() : "",
      productImage: p.productImage ? p.productImage.trim() : "",
    }));

    const lottery = await Lottery.create({
      title: title.trim(),
      description: description ? description.trim() : "",
      image: imageUrl,
      ticketPrice: numPrice,
      totalTickets: Number(totalTickets) || 0,
      drawDate: new Date(drawDate),
      prizes: formattedPrizes,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    return res.status(201).json({
      success: true,
      message: "Lottery created successfully!",
      lottery,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateLotteryAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      image,
      ticketPrice,
      totalTickets,
      drawDate,
      prizes,
      isActive,
      status,
    } = req.body;

    const lottery = await Lottery.findById(id);
    if (!lottery) {
      return res.status(404).json({ success: false, message: "Lottery not found" });
    }

    if (lottery.status === "drawn") {
      return res.status(400).json({ success: false, message: "Cannot edit a lottery that has already been drawn" });
    }

    if (title) lottery.title = title.trim();
    if (description !== undefined) lottery.description = description.trim();
    if (ticketPrice) lottery.ticketPrice = Number(ticketPrice);
    if (totalTickets !== undefined) lottery.totalTickets = Number(totalTickets);
    if (drawDate) lottery.drawDate = new Date(drawDate);
    if (isActive !== undefined) lottery.isActive = Boolean(isActive);
    if (status && ["active", "cancelled"].includes(status)) lottery.status = status;

    if (req.file) {
      try {
        lottery.image = await uploadToCloudinary(req.file.buffer);
      } catch (err) {}
    } else if (image) {
      lottery.image = image.trim();
    }

    if (prizes) {
      let parsedPrizes = [];
      if (typeof prizes === "string") {
        try {
          parsedPrizes = JSON.parse(prizes);
        } catch (e) {
          parsedPrizes = [];
        }
      } else if (Array.isArray(prizes)) {
        parsedPrizes = prizes;
      }

      if (parsedPrizes.length > 0) {
        lottery.prizes = parsedPrizes.map((p, idx) => ({
          rank: p.rank || idx + 1,
          name: p.name || `${idx + 1}${idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th"} Prize`,
          rewardType: p.rewardType === "product" ? "product" : "cash",
          rewardAmount: Number(p.rewardAmount) || 0,
          productTitle: p.productTitle ? p.productTitle.trim() : "",
          productImage: p.productImage ? p.productImage.trim() : "",
        }));
      }
    }

    await lottery.save();

    return res.status(200).json({
      success: true,
      message: "Lottery updated successfully!",
      lottery,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteLotteryAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const lottery = await Lottery.findById(id);
    if (!lottery) {
      return res.status(404).json({ success: false, message: "Lottery not found" });
    }

    await LotteryTicket.deleteMany({ lottery: lottery._id });
    await Lottery.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Lottery and associated tickets deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLotteryTicketsAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const tickets = await LotteryTicket.find({ lottery: id })
      .populate("user", "name phone email balance")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, tickets });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.drawLotteryAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { drawMode, manualWinners } = req.body;

    const lottery = await Lottery.findById(id);
    if (!lottery) {
      return res.status(404).json({ success: false, message: "Lottery not found" });
    }

    if (lottery.status === "drawn") {
      return res.status(400).json({ success: false, message: "This lottery has already been drawn!" });
    }

    const tickets = await LotteryTicket.find({ lottery: id }).populate("user");
    if (!tickets || tickets.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No tickets have been sold for this lottery yet. Cannot draw!",
      });
    }

    if (lottery.prizes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please configure at least one prize for this lottery before drawing.",
      });
    }

    const assignedTicketIds = new Set();
    const winnersList = [];

    if (drawMode === "manual") {
      let parsedManual = [];
      if (typeof manualWinners === "string") {
        try {
          parsedManual = JSON.parse(manualWinners);
        } catch (e) {
          parsedManual = [];
        }
      } else if (Array.isArray(manualWinners)) {
        parsedManual = manualWinners;
      }

      for (let i = 0; i < lottery.prizes.length; i++) {
        const prize = lottery.prizes[i];
        const manualEntry = parsedManual.find(
          (m) => Number(m.rank) === Number(prize.rank) || (m.prizeId && m.prizeId.toString() === prize._id.toString())
        );

        let selectedTicket = null;
        if (manualEntry && manualEntry.ticketId) {
          selectedTicket = tickets.find((t) => t._id.toString() === manualEntry.ticketId.toString());
        }

        if (!selectedTicket) {
          const availableTickets = tickets.filter((t) => !assignedTicketIds.has(t._id.toString()));
          if (availableTickets.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableTickets.length);
            selectedTicket = availableTickets[randomIndex];
          } else {
            selectedTicket = tickets[0];
          }
        }

        if (selectedTicket) {
          assignedTicketIds.add(selectedTicket._id.toString());

          prize.winnerUser = selectedTicket.user._id;
          prize.winnerTicket = selectedTicket._id;
          prize.winnerTicketNumber = selectedTicket.ticketNumber;

          selectedTicket.isWinner = true;
          selectedTicket.prizeRank = prize.rank;
          selectedTicket.prizeName = prize.name;
          selectedTicket.prizeType = prize.rewardType;
          selectedTicket.prizeValue = prize.rewardType === "cash" ? prize.rewardAmount : prize.productTitle;
          await selectedTicket.save();

          if (prize.rewardType === "cash" && prize.rewardAmount > 0) {
            await User.findByIdAndUpdate(selectedTicket.user._id, {
              $inc: { balance: Number(prize.rewardAmount) },
            });

            try {
              await Notification.create({
                user: selectedTicket.user._id,
                title: "🎉 Lottery Prize Won!",
                message: `Congratulations! Your ticket #${selectedTicket.ticketNumber} won ${prize.name} of ৳${Number(prize.rewardAmount).toFixed(2)} in "${lottery.title}"! Amount added to your balance.`,
                type: "lottery",
                amount: prize.rewardAmount,
              });
            } catch (err) {}
          } else if (prize.rewardType === "product") {
            try {
              await Notification.create({
                user: selectedTicket.user._id,
                title: "🎁 Lottery Product Won!",
                message: `Congratulations! Your ticket #${selectedTicket.ticketNumber} won ${prize.productTitle} (${prize.name}) in "${lottery.title}"! Our support team will contact you.`,
                type: "lottery",
              });
            } catch (err) {}
          }

          winnersList.push({
            rank: prize.rank,
            prizeName: prize.name,
            rewardType: prize.rewardType,
            reward: prize.rewardType === "cash" ? `৳${prize.rewardAmount}` : prize.productTitle,
            winnerName: selectedTicket.user?.name || "Participant",
            winnerPhone: selectedTicket.user?.phone || "",
            ticketNumber: selectedTicket.ticketNumber,
          });
        }
      }
    } else {
      const shuffledTickets = [...tickets].sort(() => 0.5 - Math.random());

      for (let i = 0; i < lottery.prizes.length; i++) {
        const prize = lottery.prizes[i];
        let selectedTicket = shuffledTickets.find((t) => !assignedTicketIds.has(t._id.toString()));

        if (!selectedTicket) {
          selectedTicket = shuffledTickets[0];
        }

        if (selectedTicket) {
          assignedTicketIds.add(selectedTicket._id.toString());

          prize.winnerUser = selectedTicket.user._id;
          prize.winnerTicket = selectedTicket._id;
          prize.winnerTicketNumber = selectedTicket.ticketNumber;

          selectedTicket.isWinner = true;
          selectedTicket.prizeRank = prize.rank;
          selectedTicket.prizeName = prize.name;
          selectedTicket.prizeType = prize.rewardType;
          selectedTicket.prizeValue = prize.rewardType === "cash" ? prize.rewardAmount : prize.productTitle;
          await selectedTicket.save();

          if (prize.rewardType === "cash" && prize.rewardAmount > 0) {
            await User.findByIdAndUpdate(selectedTicket.user._id, {
              $inc: { balance: Number(prize.rewardAmount) },
            });

            try {
              await Notification.create({
                user: selectedTicket.user._id,
                title: "🎉 Lottery Prize Won!",
                message: `Congratulations! Your ticket #${selectedTicket.ticketNumber} won ${prize.name} of ৳${Number(prize.rewardAmount).toFixed(2)} in "${lottery.title}"! Amount added to your balance.`,
                type: "lottery",
                amount: prize.rewardAmount,
              });
            } catch (err) {}
          } else if (prize.rewardType === "product") {
            try {
              await Notification.create({
                user: selectedTicket.user._id,
                title: "🎁 Lottery Product Won!",
                message: `Congratulations! Your ticket #${selectedTicket.ticketNumber} won ${prize.productTitle} (${prize.name}) in "${lottery.title}"! Our support team will contact you.`,
                type: "lottery",
              });
            } catch (err) {}
          }

          winnersList.push({
            rank: prize.rank,
            prizeName: prize.name,
            rewardType: prize.rewardType,
            reward: prize.rewardType === "cash" ? `৳${prize.rewardAmount}` : prize.productTitle,
            winnerName: selectedTicket.user?.name || "Participant",
            winnerPhone: selectedTicket.user?.phone || "",
            ticketNumber: selectedTicket.ticketNumber,
          });
        }
      }
    }

    lottery.status = "drawn";
    lottery.drawnAt = new Date();
    lottery.drawType = drawMode === "manual" ? "manual" : "auto";
    await lottery.save();

    return res.status(200).json({
      success: true,
      message: `Lottery draw completed successfully via ${lottery.drawType.toUpperCase()} mode!`,
      winners: winnersList,
      lottery,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

