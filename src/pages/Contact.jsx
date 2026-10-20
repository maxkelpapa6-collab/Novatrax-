import { useAuth } from "@/lib/AuthContext";
import MemberDirectory from "@/components/contacts/MemberDirectory";
import AdminContacts from "@/components/contacts/AdminContacts";
import SupportCard from "@/components/contacts/SupportCard";

export default function Contact() {
  const { user } = useAuth();

  if (user?.role === "admin") {
    return <AdminContacts adminEmail={user?.email} />;
  }
  return (
    <>
      <MemberDirectory />
      <SupportCard />
    </>
  );
}