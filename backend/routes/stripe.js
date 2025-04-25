const express = require('express');
const Stripe = require('stripe');
const authMiddleware = require('../middleware/auth');
const UserM = require('../models/User');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// Create Checkout Session
router.post('/checkout', authMiddleware, async (req, res) => {
  const { plan } = req.body;
  try {
    const user = await UserM.findById(req.user.userId);
    const priceIds = {
      basic: process.env.STRIPE_BASIC_PRICE_ID,
      advanced: process.env.STRIPE_ADVANCED_PRICE_ID,
    };
    if (!priceIds[plan]) {
      return res.status(400).json({ message: 'Invalid plan' });
    }
    console.log("User:", user);
    

    // Create or retrieve Stripe customer
    let customer;
    if (!user.stripeCustomerId) {
      customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user._id.toString() },
      });
      user.stripeCustomerId = customer.id;
      await user.save();
    } else {
      customer = await stripe.customers.retrieve(user.stripeCustomerId);
      if (!customer || customer.deleted) {
        customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user._id.toString() },
        });
        user.stripeCustomerId = customer.id;
        await user.save();
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{ price: priceIds[plan], quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/plans`,
      metadata: { plan }, // Store plan in metadata for webhook
    });
    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Subscription Status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = await UserM.findById(req.user.userId);
    if (!user.stripeCustomerId) {
      return res.json({ plan: user.plan || 'free' });
    }
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'active',
      expand: ['data.plan.product'],
    });
    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      const planNickname = subscription.metadata.plan || subscription.plan.nickname?.toLowerCase() || user.plan;
      return res.json({ plan: planNickname });
    }
    return res.json({ plan: user.plan || 'free' });
  } catch (error) {
    console.error('Status error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Stripe Webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
 
 console.log("Start Web Hook")
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      const subscription = event.data.object;

      // Default to null
      let plan = null;

      // Try to get plan from subscription metadata
      if (subscription.metadata?.plan) {
        plan = subscription.metadata.plan;
        console.log("Plan in If", plan);
        
      } else if (subscription.latest_invoice) {
        // Fallback: Get Checkout Session to read plan metadata
        const invoice = await stripe.invoices.retrieve(subscription.latest_invoice);
        if (invoice.subscription) {
          const checkoutSessions = await stripe.checkout.sessions.list({
            subscription: invoice.subscription,
            limit: 1,
          });

          if (checkoutSessions.data.length > 0 && checkoutSessions.data[0].metadata?.plan) {
            plan = checkoutSessions.data[0].metadata.plan;
          }
          console.log("Plan in If 2", plan);
        }
      }

      if (!plan || !['basic', 'advanced'].includes(plan)) {
        console.warn('Invalid or missing plan in subscription:', subscription.id);
        return res.json({ received: true });
      }
      console.log("subscription", subscription);
      // Find user by stripeCustomerId or metadata
      let user = await UserM.findOne({ stripeCustomerId: subscription.customer });

      if (!user) {
        const customer = await stripe.customers.retrieve(subscription.customer, {
          expand: ['metadata'],
        });
        if (customer.metadata.userId) {
          user = await UserM.findById(customer.metadata.userId);
          if (user && !user.stripeCustomerId) {
            user.stripeCustomerId = subscription.customer;
          }
        }
      }

      if (user) {
        user.plan = plan;
        await user.save();
        console.log(`Updated user ${user._id} plan to ${plan}`);
      } else {
        console.warn('User not found for subscription:', subscription.id);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(400).json({ message: 'Webhook error' });
  }
});

module.exports = router;