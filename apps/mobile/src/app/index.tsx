import { Redirect } from 'expo-router';

/** `/` opens Today (reminders, widgets and the Live Activity link to `dosely://today`). */
export default function Index() {
  return <Redirect href="/today" />;
}
