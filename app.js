const express = require('express');
const bodyParser = require('body-parser');
const path = require("path");
const mongoose = require('mongoose'); // <-- You will need to install this
const cors = require('cors'); 

const app = express();

// --- 1. Middleware ---
app.use(bodyParser.json());
app.use(cors()); // Allow browser requests

// --- 2. MongoDB Connection ---
// This connects to a local DB named 'bankingDB'.
const MONGO_URI = 'mongodb://localhost:27017/bankingDB';

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- 3. Mongoose Schema & Model ---
const accountSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    required: true,
    min: 0,
    default: 1000 // Default balance for new accounts
  }
});

const Account = mongoose.model('Account', accountSchema);

// --- 4. API Routes ---

/**
 * [SETUP] POST /setup-accounts
 * Clears the DB and creates two sample accounts for testing.
 */
app.post('/setup-accounts', async (req, res) => {
  try {
    // Clear all existing accounts
    await Account.deleteMany({});
    
    // Create two new accounts
    const accounts = [
      { name: 'UserA', balance: 1000 },
      { name: 'UserB', balance: 500 }
    ];
    
    const createdAccounts = await Account.insertMany(accounts);
    res.status(201).json({
      message: 'Test accounts created successfully!',
      accounts: createdAccounts
    });
  } catch (error) {
    res.status(500).json({ message: 'Error setting up accounts', error: error.message });
  }
});

/**
 * [READ] GET /accounts
 * Retrieves all accounts (to check balances)
 */
app.get('/accounts', async (req, res) => {
  try {
    const accounts = await Account.find();
    res.status(200).json(accounts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching accounts', error: error.message });
  }
});

/**
 * [TRANSFER] POST /transfer
 * The main logic for the task.
 */
app.post('/transfer', async (req, res) => {
  try {
    const { fromAccountId, toAccountId, amount } = req.body;

    // --- 1. Validate Input ---
    if (!fromAccountId || !toAccountId || !amount) {
      return res.status(400).json({ message: 'Missing fields: fromAccountId, toAccountId, and amount are required.' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number.' });
    }
    if (fromAccountId === toAccountId) {
      return res.status(400).json({ message: 'Cannot transfer money to the same account.' });
    }
    if (!mongoose.Types.ObjectId.isValid(fromAccountId) || !mongoose.Types.ObjectId.isValid(toAccountId)) {
      return res.status(400).json({ message: 'Invalid account ID format.' });
    }

    // --- 2. Find Accounts ---
    const sender = await Account.findById(fromAccountId);
    const receiver = await Account.findById(toAccountId);

    if (!sender) {
      return res.status(404).json({ message: 'Sender account not found.' });
    }
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver account not found.' });
    }

    // --- 3. Validate Balance (The Core Logic) ---
    if (sender.balance < amount) {
      return res.status(400).json({ 
        message: 'Insufficient funds.',
        currentBalance: sender.balance,
        amountToTransfer: amount
      });
    }

    // --- 4. Perform Transfer (No DB Transaction) ---
    // This is the "logical" part. We update the objects in memory *after* validation.
    sender.balance -= amount;
    receiver.balance += amount;

    // Save both changes to the database
    await sender.save();
    await receiver.save();
    
    // Success!
    res.status(200).json({
      message: 'Transfer successful!',
      senderNewBalance: sender.balance,
      receiverNewBalance: receiver.balance
    });

  } catch (error) {
    // This will catch any errors during .save()
    res.status(500).json({ message: 'Error during transfer', error: error.message });
  }
});

// --- 5. Frontend HTML Route ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- 6. Start Server ---
const port = 3000;
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Use the ByteXL 'Preview' button for port 3000.`);
});
