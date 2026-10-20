import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import MyNetwork from '@/pages/MyNetwork';
import Wallet from '@/pages/Wallet';
import Profile from '@/pages/Profile';
import Formation from '@/pages/Formation';
import ApkPro from '@/pages/ApkPro';
import Marketplace from '@/pages/Marketplace';
import ProductDetail from '@/pages/ProductDetail';
import MyShop from '@/pages/MyShop';
import MyPurchases from '@/pages/MyPurchases';
import PaymentLinks from '@/pages/PaymentLinks';
import PaymentLinkPay from '@/pages/PaymentLinkPay';
import Contact from '@/pages/Contact';
import Inbox from '@/pages/Inbox';
import Admin from '@/pages/Admin';
import Terms from '@/pages/Terms';
import Privacy from '@/pages/Privacy';
import AppLayout from '@/components/AppLayout';
// NOVATRAX routes
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/p/:id" element={<PaymentLinkPay />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/reseau" element={<MyNetwork />} />
          <Route path="/portefeuille" element={<Wallet />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/formation" element={<Formation />} />
          <Route path="/apk-pro" element={<ApkPro />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/marketplace/produit/:id" element={<ProductDetail />} />
          <Route path="/ma-boutique" element={<MyShop />} />
          <Route path="/liens-paiement" element={<PaymentLinks />} />
          <Route path="/mes-achats" element={<MyPurchases />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/boite-reception" element={<Inbox />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App