import { useStripe } from '@stripe/stripe-react-native';
import { apiPost } from '@/lib/api';

export async function payForClass(
  initPaymentSheet: any,
  presentPaymentSheet: any,
  classId: string,
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Create booking first (pending)
    const intentRes = await apiPost('/stripe/payment-intent', {
      type: 'class_booking',
      classId,
      bookingId,
    });

    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: intentRes.clientSecret,
      merchantDisplayName: 'Crusader 9 Boxing',
      style: 'alwaysDark',
      returnURL: 'crusader9://stripe-success',
      applePay: { merchantCountryCode: 'GB' },
      googlePay: { merchantCountryCode: 'GB', testEnv: true },
    });
    if (initError) return { success: false, error: initError.message };

    const { error: presentError } = await presentPaymentSheet();
    if (presentError) return { success: false, error: presentError.message };

    // Confirm booking server-side
    await apiPost('/stripe/confirm-booking', {
      paymentIntentId: intentRes.clientSecret.split('_secret_')[0],
      type: 'class_booking',
      bookingId,
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function payForPT(
  initPaymentSheet: any,
  presentPaymentSheet: any,
  ptBookingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const intentRes = await apiPost('/stripe/payment-intent', {
      type: 'pt_booking',
      ptBookingId,
    });

    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: intentRes.clientSecret,
      merchantDisplayName: 'Crusader 9 Boxing',
      style: 'alwaysDark',
      returnURL: 'crusader9://stripe-success',
      applePay: { merchantCountryCode: 'GB' },
      googlePay: { merchantCountryCode: 'GB', testEnv: true },
    });
    if (initError) return { success: false, error: initError.message };

    const { error: presentError } = await presentPaymentSheet();
    if (presentError) return { success: false, error: presentError.message };

    await apiPost('/stripe/confirm-booking', {
      paymentIntentId: intentRes.clientSecret.split('_secret_')[0],
      type: 'pt_booking',
      ptBookingId,
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function payForDayPass(
  initPaymentSheet: any,
  presentPaymentSheet: any,
  dates: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const intentRes = await apiPost('/stripe/payment-intent', {
      type: 'day_pass',
      dates,
    });

    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: intentRes.clientSecret,
      merchantDisplayName: 'Crusader 9 Boxing',
      style: 'alwaysDark',
      returnURL: 'crusader9://stripe-success',
      applePay: { merchantCountryCode: 'GB' },
      googlePay: { merchantCountryCode: 'GB', testEnv: true },
    });
    if (initError) return { success: false, error: initError.message };

    const { error: presentError } = await presentPaymentSheet();
    if (presentError) return { success: false, error: presentError.message };

    await apiPost('/stripe/confirm-booking', {
      paymentIntentId: intentRes.clientSecret.split('_secret_')[0],
      type: 'day_pass',
      dates: JSON.stringify(dates),
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
