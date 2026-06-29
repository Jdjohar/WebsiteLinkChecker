const express = require('express');
const Stripe = require('stripe');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// Create Checkout Session
router.post('/checkout', authMiddleware, async (req, res) => {
  const { plan } = req.body;
  try {
    const user = await User.findById(req.user.userId);
    const priceIds = {
      basic: process.env.STRIPE_BASIC_PRICE_ID,
      advanced: process.env.STRIPE_ADVANCED_PRICE_ID,
    };
    if (!priceIds[plan]) {
      return res.status(400).json({ message: 'Invalid plan' });
    }
    console.log('Checkout - User:', { userId: user._id, email: user.email, plan });

    // Create or retrieve Stripe customer
    let customer;
    if (!user.stripeCustomerId) {
      customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user._id.toString() },
      });
      user.stripeCustomerId = customer.id;
      await user.save();
      console.log('Checkout - Created customer:', customer.id);
    } else {
      customer = await stripe.customers.retrieve(user.stripeCustomerId);
      if (!customer || customer.deleted) {
        customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user._id.toString() },
        });
        user.stripeCustomerId = customer.id;
        await user.save();
        console.log('Checkout - Recreated customer:', customer.id);
      } else {
        console.log('Checkout - Retrieved customer:', customer.id);
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
    console.log('Checkout - Created session:', { sessionId: session.id, plan });
    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', { message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Subscription Status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    console.log('Status - User:', { userId: user._id, stripeCustomerId: user.stripeCustomerId, plan: user.plan });
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
      console.log('Status - Active subscription:', { subscriptionId: subscription.id, plan: planNickname, metadata: subscription.metadata });
      return res.json({ plan: planNickname });
    }
    console.log('Status - No active subscriptions');
    return res.json({ plan: user.plan || 'free' });
  } catch (error) {
    console.error('Status error:', { message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Server error' });
  }
});

// Stripe Webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const webhookUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  console.log(`Webhook - Called at URL: ${webhookUrl}`);
  console.log('Webhook - Received request');
  console.log('Webhook - Request body type:', typeof req.body, Buffer.isBuffer(req.body));
  const sig = req.headers['stripe-signature'];
  console.log(sig,'Webhook - Received request');
  try {
    console.log(process.env.STRIPE_WEBHOOK_SECRET, 'Webhook - Try');
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log('Webhook - Event:', { type: event.type, id: event.id });

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      console.log('Webhook - Subscription:', { subscriptionId: subscription.id, customer: subscription.customer, metadata: subscription.metadata });

      // Default to null
      let plan = null;

      // Try to get plan from subscription metadata
      if (subscription.metadata?.plan) {
        plan = subscription.metadata.plan;
        console.log('Webhook - Plan from subscription metadata:', plan);
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
            console.log('Webhook - Plan from checkout session metadata:', plan);
          }
        }
      }

      if (!plan || !['basic', 'advanced'].includes(plan)) {
        console.warn('Webhook - Invalid or missing plan in subscription:', { subscriptionId: subscription.id, plan });
        return res.json({ received: true });
      }

      // Find user by stripeCustomerId or metadata
      let user = await User.findOne({ stripeCustomerId: subscription.customer });
      console.log('Webhook - User lookup by stripeCustomerId:', { found: !!user, stripeCustomerId: subscription.customer });

      if (!user) {
        const customer = await stripe.customers.retrieve(subscription.customer, {
          expand: ['metadata'],
        });
        console.log('Webhook - Customer metadata:', { userId: customer.metadata.userId });
        if (customer.metadata.userId) {
          user = await User.findById(customer.metadata.userId);
          if (user && !user.stripeCustomerId) {
            user.stripeCustomerId = subscription.customer;
            console.log('Webhook - Assigned stripeCustomerId to user:', user._id);
          }
        }
      }

      if (user) {
        user.plan = plan;
        await user.save();
        console.log('Webhook - Updated user:', { userId: user._id, plan });
      } else {
        console.warn('Webhook - User not found for subscription:', { subscriptionId: subscription.id });
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', { message: error.message, stack: error.stack });
    res.status(400).json({ message: 'Webhook error' });
  }
});

module.exports = router;