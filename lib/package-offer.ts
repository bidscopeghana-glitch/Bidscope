// New sales only. Legacy subscription codes and provider plans remain intact.
export const CURRENT_PLAN_CODES = ["pro_launch_monthly","pro_launch_annual","premium_launch_monthly","premium_launch_annual","platinum_launch_monthly","platinum_launch_annual"] as const;
export const LAUNCH_PRICES = {pro:{monthly:150,annual:1500},premium:{monthly:300,annual:3000},platinum:{monthly:600,annual:6000}} as const;
