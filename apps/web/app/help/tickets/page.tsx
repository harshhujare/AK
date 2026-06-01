import { redirect } from 'next/navigation';

// Redirect old /help/tickets URL to the unified tabbed help page
export default function TicketsRedirectPage() {
  redirect('/help?tab=tickets');
}
