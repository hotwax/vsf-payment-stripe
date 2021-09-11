import config from 'config'
import PaymentDetails from '@vue-storefront/core/modules/checkout/types/PaymentDetails'
import { processLocalizedURLAddress } from '@vue-storefront/core/helpers'
import getApiEndpointUrl from '@vue-storefront/core/helpers/getApiEndpointUrl';
import { TaskQueue } from '@vue-storefront/core/lib/sync'

const authorizePayment = (payment: PaymentDetails, personalDetails: any) => {
    return TaskQueue.execute({
        url: processLocalizedURLAddress(getApiEndpointUrl(config.cart, 'payment_endpoint')),
        payload: {
            method: 'POST',
            body: JSON.stringify({ payment, personalDetails })
        }
    })
}

export default authorizePayment;

