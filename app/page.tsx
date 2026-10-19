import AdminApp from "@/components/admin/AdminApp";
import BBRApp from "@/components/BBRApp";
import { APP_MODE } from "@/lib/admin/mode";

export default function Page() {
  return APP_MODE === "ADMIN" ? <AdminApp /> : <BBRApp />;
}
