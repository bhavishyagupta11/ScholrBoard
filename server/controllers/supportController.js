import ContactMessage from '../models/ContactMessage.js';
import { sendContactNotification } from '../services/emailService.js';

/**
 * @desc    Submit a support contact query
 * @route   POST /api/support/contact
 * @access  Public
 */
export const createContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields (name, email, subject, message) are required.',
      });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || !trimmedEmail || !trimmedSubject || !trimmedMessage) {
      return res.status(400).json({
        success: false,
        message: 'All fields must contain non-empty characters.',
      });
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,4})+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    const contactMessage = await ContactMessage.create({
      name: trimmedName,
      email: trimmedEmail,
      subject: trimmedSubject,
      message: trimmedMessage,
    });

    // Step 1: Respond to user immediately (MongoDB save succeeded)
    res.status(201).json({
      success: true,
      message: 'Your message has been submitted successfully.',
      contactMessage,
    });

    // Step 2: Fire-and-forget email notification (NEVER blocks the response)
    // Errors are caught internally by emailService — no await, no .catch needed here
    sendContactNotification({
      name:    trimmedName,
      email:   trimmedEmail,
      subject: trimmedSubject,
      message: trimmedMessage,
      _id:     contactMessage._id,
    });

    // Note: return is intentionally after res.json() to avoid double-send
    return;
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map((item) => item.message),
      });
    }
    console.error('createContactMessage error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit contact message. Please try again.',
    });
  }
};

/**
 * @desc    Get all contact messages (paginated, sorted by newest)
 * @route   GET /api/support/contact
 * @access  Private — Admin only
 */
export const getContactMessages = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [messages, total] = await Promise.all([
      ContactMessage.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('-__v'),
      ContactMessage.countDocuments({}),
    ]);

    return res.json({
      success: true,
      messages,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error('getContactMessages error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch contact messages.' });
  }
};
