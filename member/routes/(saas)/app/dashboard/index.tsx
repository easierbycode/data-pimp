import { Head } from "fresh/runtime";
import { define } from "../../../../utils.ts";
import MemberDashboardV2 from "../../../../islands/MemberDashboardV2.tsx";

export default define.page(function DashboardPage() {
  return (
    <>
      <Head>
        <title>Dashboard · LifePreneur</title>
      </Head>
      <MemberDashboardV2 />
    </>
  );
});
