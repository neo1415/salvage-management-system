import {defineConfig} from 'vitest/config';
import path from 'node:path';
export default defineConfig({resolve:{alias:{'@':path.resolve(__dirname,'src')}},test:{environment:'node',setupFiles:[],include:['tests/unit/departments/department-access.test.ts','tests/unit/auctions/early-close-approval.test.ts','tests/unit/seo/public-routes.test.ts'],env:{DATABASE_URL:'postgres://invalid:invalid@127.0.0.1:1/launch_tests_disabled'},maxWorkers:1}});
