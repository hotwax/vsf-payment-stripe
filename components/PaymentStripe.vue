<template>

  <div class="mb15 mt20 vsf-stripe-container">
    <h4 class="mt0">
      <label for="vsf-stripe-card-element">
        {{ $t('Credit or debit card:') }}
      </label>
    </h4>
    <div class="bg-cl-secondary px20 py20">
      <form action="" id="payment-form">
        <div class="form-row">

          <div id="vsf-stripe-card-element">
            &nbsp;
            <!-- A Stripe Element will be inserted here. -->
          </div>

          <!-- Used to display Element errors. -->
          <div id="vsf-stripe-card-errors" role="alert">
            &nbsp;
          </div>
        </div>
      </form>
    </div>
  </div>

</template>

<script>
import { mapGetters, mapState } from 'vuex'
import i18n from '@vue-storefront/i18n'
import EventBus from '@vue-storefront/core/compatibility/plugins/event-bus'

export default {
  name: 'PaymentStripe',
  data () {
    return {
      stripe: {
        instance: null,
        elements: null,
        card: null
      }
    }
  },
  computed: {
    ...mapGetters({
      paymentDetails: 'checkout/getPaymentDetails',
    }),
    ...mapState({
      stripeConfig: state => state.config.stripe
    })
  },
  beforeMount () {
    EventBus.$on('order-after-placed', this.onAfterPlaceOrder)
    // Added Stripe specific event needed for Not Naked/Capybara theme where there is a separate confirmation page after payment 
    // Ready to place order, handle anything we need to, generating, validating stripe requests & tokens ect.
    EventBus.$on('checkout-after-stripe-payment', this.onBeforePlaceOrder)
  },
  beforeDestroy () {
    EventBus.$off('order-after-placed', this.onAfterPlaceOrder)
    EventBus.$off('checkout-after-stripe-payment', this.onBeforePlaceOrder)
  },
  mounted () {
    // Load the stripe.js elements script.
    // As it's callback, Configure stripe to run.
    this.loadStripeDependencies(this.configureStripe)

    // Ready to place order, handle anything we need to, generating, validating stripe requests & tokens ect.
    EventBus.$on('checkout-payment-method-changed', (paymentMethodCode) => {
      if (paymentMethodCode !== this.stripeConfig.paymentMethodCode) {
        // unregister the extension placeorder handler
        EventBus.$off('checkout-before-placeOrder', this.onBeforePlaceOrder)
      }
    })
  },
  methods: {
    onAfterPlaceOrder () {
      // Stop display loader
      EventBus.$emit('notification-progress-stop')
    },
    onBeforePlaceOrder (payment, $v) {
      // TODO Check why processStripeForm called inside onBeforePlaceOrder and directly call/add logic here itself
      this.processStripeForm(payment, $v)
    },
    loadStripeDependencies (callback) {
      let stripeJsUrl = 'https://js.stripe.com/v3/'
      let docHead = document.getElementsByTagName('head')[0]
      let docScript = document.createElement('script')
      docScript.type = 'text/javascript'
      docScript.src = stripeJsUrl

      // When script is ready fire our callback.
      docScript.onreadystatechange = callback
      docScript.onload = callback
      docHead.appendChild(docScript)
    },
    configureStripe () {
      if (!this.stripeConfig.hasOwnProperty('apiKey')) {
        return false
      }

      // Create a new Stripe client.
      this.stripe.instance = window.Stripe(this.stripeConfig.apiKey)

      // Create an instance of Elements.
      this.stripe.elements = this.stripe.instance.elements()

      // Create the stripe elements card
      this.createElements()

      // Add the event listeners for stripe.
      this.bindEventListeners()
    },
    createElements () {
      let style = this.stripeConfig.hasOwnProperty('style') ? this.stripeConfig.style : {}
      let options = this.stripeConfig.hasOwnProperty('options') ? this.stripeConfig.options : {};
      let cardOptions = {};
      cardOptions.style = style;
      Object.keys(options).forEach(function (option) {
        cardOptions[option] = options[option];
      });
      // Create an instance of the card Element.
      this.stripe.card = this.stripe.elements.create('card', cardOptions)

      // Add an instance of the card Element into the `card-element` <div>.
      this.stripe.card.mount('#vsf-stripe-card-element')
    },
    bindEventListeners () {
      // Handle real-time validation errors from the card Element.
      this.stripe.card.addEventListener('change', this.onStripeCardChange)
    },
    onStripeCardChange (event) {
      let displayError = document.getElementById('vsf-stripe-card-errors')
      displayError.textContent = event.error ? event.error.message : ''
    },
    beforeDestroy () {
      this.unbindEventListeners()
    },
    unbindEventListeners () {
      this.stripe.card.removeEventListener('change', this.onStripeCardChange)
    },
    processStripeForm (payment, $v) {
      // We are not calling placeOrderWithPayload so commented unused code
      // let self = this

      // Start display loader
      EventBus.$emit('notification-progress-start', [i18n.t('Processing Payment'), '...'].join(''))

      var data = {
        billing_details: {}
      };

      let firstName = payment.firstName;
      let lastName = payment.lastName;

      const name = firstName ? firstName : ""  + " " + lastName ? lastName : "";
      if(name) data["billing_details"]["name"] = name;

      // Create payment method with Stripe
      this.stripe.instance.createPaymentMethod('card', this.stripe.card, data).then((result) => {
        if (result.error) {
          // Inform the user if there was an error.
          let errorElement = document.getElementById('vsf-stripe-card-errors')

          errorElement.textContent = result.error.message

          // Stop display loader
          EventBus.$emit('notification-progress-stop')
        } else {
          // TODO Check if brand and last4 is needed an pass it to show to customer
          payment.paymentMethodAdditional = {
            id: result.paymentMethod.id
          }
          this.$bus.$emit('checkout-after-paymentDetails', payment, $v);
          // This is done in confirm order page instead
          // self.placeOrderWithPayload(this.formatTokenPayload(result.paymentMethod))
          EventBus.$emit('notification-progress-stop')
        }
      })
    },
    checkoutAfterPaymentDetails (payment, $v) {
      this.$bus.$emit('checkout-after-paymentDetails', payment, $v)
    },
    placeOrderWithPayload (payload) {
      EventBus.$emit('checkout-do-placeOrder', payload)
    },
    formatTokenPayload (token) {
      let platform = this.stripeConfig.hasOwnProperty('backendPlatform') ? this.stripeConfig.backendPlatform : 'default'
      if (platform === 'magento2') {
        return {
          cc_save: false,
          cc_stripejs_token: `${token.id}:${token.card.brand}:${token.card.last4}`
        }
      } else {
        return token
      }
    }
  }
}
</script>

<style lang="scss" scoped>

  .vsf-stripe-container {
    flex: 1;
    label {
      font-weight: 500;
      font-size: 14px;
      display: block;
      margin-bottom: 8px;
      color: #818992;
    }

    .StripeElement {
      background-color: white;
      padding: 10px 12px;
      border-radius: 4px;
      border: 1px solid transparent;
      box-shadow: 0 1px 3px 0 #e6ebf1;
      -webkit-transition: box-shadow 150ms ease;
      transition: box-shadow 150ms ease;
    }

    .StripeElement--focus {
      box-shadow: 0 1px 3px 0 #cfd7df;
    }

    .StripeElement--invalid {
      border-color: #fa755a;
    }

    .StripeElement--webkit-autofill {
      background-color: #fefde5 !important;
    }
  }
  #vsf-stripe-card-errors {
    margin: 8px auto 0;
    color: #fa755a;
  }
</style>
