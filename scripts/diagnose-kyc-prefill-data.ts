import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema/vendors";
import { users } from "@/lib/db/schema/users";
import { eq } from "drizzle-orm";

async function diagnoseKYCData() {
  console.log("=== KYC Pre-fill Data Diagnosis ===\n");

  try {
    // Get a sample vendor with their user data
    const vendorData = await db
      .select()
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(eq(vendors.tier, 'tier1_bvn'))
      .limit(5);

    console.log("Sample Vendor Data:");
    console.log("==================");
    
    vendorData.forEach((row, idx) => {
      const v = row.vendors;
      const u = row.users;
      console.log(`\nVendor ${idx + 1}:`);
      console.log(`  Vendor ID: ${v.id}`);
      console.log(`  User ID: ${u.id}`);
      console.log(`  Phone (users.phone): ${u.phone || "NULL"}`);
      console.log(`  BVN (vendors.bvnEncrypted): ${v.bvnEncrypted ? "[ENCRYPTED]" : "NULL"}`);
      console.log(`  DOB (users.dateOfBirth): ${u.dateOfBirth || "NULL"}`);
      console.log(`  Full Name: ${u.fullName || "NULL"}`);
      console.log(`  Email: ${u.email || "NULL"}`);
    });

    console.log("\n=== Field Availability Summary ===");
    const summary = {
      phone: vendorData.filter(row => row.users.phone).length,
      bvn: vendorData.filter(row => row.vendors.bvnEncrypted).length,
      dob: vendorData.filter(row => row.users.dateOfBirth).length,
    };
    
    console.log(`Vendors with phone: ${summary.phone}/${vendorData.length}`);
    console.log(`Vendors with BVN: ${summary.bvn}/${vendorData.length}`);
    console.log(`Vendors with DOB: ${summary.dob}/${vendorData.length}`);

  } catch (error) {
    console.error("Error:", error);
  }
}

diagnoseKYCData();
