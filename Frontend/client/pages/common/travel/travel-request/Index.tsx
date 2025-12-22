import { TravelApplicationForm } from "./components/TravelApplicationForm";
import { Helmet } from "react-helmet-async";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Travel Application Form | Submit Your Travel Request</title>
        <meta name="description" content="Submit your travel application with flight, train, accommodation, and conveyance booking details. Easy-to-use multi-step form with real-time validation." />
      </Helmet>
      <TravelApplicationForm />
    </>
  );
};

export default Index;