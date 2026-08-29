export interface ProfileCompletionResult {
  completionPercentage: number;
  isProfileComplete: boolean;
  missingFields: string[];
  totalFields: number;
  completedFieldsCount: number;
}

export function calculateUserProfileCompletion(profile: any): ProfileCompletionResult {
  if (!profile) {
    return {
      completionPercentage: 0,
      isProfileComplete: false,
      missingFields: [
        'fullName',
        'phoneNumber',
        'address',
        'age',
        'gender',
        'height',
        'weight',
        'currentActivityLevel',
        'currentDiet',
        'primaryGoal',
        'motivationLevel',
        'profileImage',
      ],
      totalFields: 12,
      completedFieldsCount: 0,
    };
  }

  const checks: { name: string; isPresent: boolean }[] = [
    {
      name: 'fullName',
      isPresent: Boolean(profile.fullName && String(profile.fullName).trim().length > 0),
    },
    {
      name: 'phoneNumber',
      isPresent: Boolean(profile.phoneNumber && String(profile.phoneNumber).trim().length > 0),
    },
    {
      name: 'address',
      isPresent: Boolean(profile.address && String(profile.address).trim().length > 0),
    },
    {
      name: 'age',
      isPresent: profile.age !== null && profile.age !== undefined && Number(profile.age) > 0,
    },
    {
      name: 'gender',
      isPresent: Boolean(profile.gender),
    },
    {
      name: 'height',
      isPresent: profile.height !== null && profile.height !== undefined && Number(profile.height) > 0,
    },
    {
      name: 'weight',
      isPresent: profile.weight !== null && profile.weight !== undefined && Number(profile.weight) > 0,
    },
    {
      name: 'currentActivityLevel',
      isPresent: Boolean(profile.currentActivityLevel),
    },
    {
      name: 'currentDiet',
      isPresent: Boolean(profile.currentDiet),
    },
    {
      name: 'primaryGoal',
      isPresent: Array.isArray(profile.primaryGoal) && profile.primaryGoal.length > 0,
    },
    {
      name: 'motivationLevel',
      isPresent: profile.motivationLevel !== null && profile.motivationLevel !== undefined && Number(profile.motivationLevel) > 0,
    },
    {
      name: 'profileImage',
      isPresent: Boolean(profile.profileImageId || profile.profileImage),
    },
  ];

  const completedFieldsCount = checks.filter((c) => c.isPresent).length;
  const totalFields = checks.length;
  const missingFields = checks.filter((c) => !c.isPresent).map((c) => c.name);
  const completionPercentage = Math.round((completedFieldsCount / totalFields) * 100);
  const isProfileComplete = completionPercentage === 100;

  return {
    completionPercentage,
    isProfileComplete,
    missingFields,
    totalFields,
    completedFieldsCount,
  };
}

export function calculateProviderProfileCompletion(profile: any): ProfileCompletionResult {
  if (!profile) {
    return {
      completionPercentage: 0,
      isProfileComplete: false,
      missingFields: [
        'location',
        'description',
        'specializationId',
        'profileImage',
        'driverLicense',
        'certificate',
        'governmentIssueId',
        'marketplaceInsurance',
        'additionalCertificate',
      ],
      totalFields: 9,
      completedFieldsCount: 0,
    };
  }

  const checks: { name: string; isPresent: boolean }[] = [
    { name: 'location', isPresent: Boolean(profile.location && String(profile.location).trim().length > 0) },
    { name: 'description', isPresent: Boolean(profile.description && String(profile.description).trim().length > 0) },
    { name: 'specializationId', isPresent: Boolean(profile.specializationId) },
    { name: 'profileImage', isPresent: Boolean(profile.profileImageId || profile.profileImage) },
    { name: 'driverLicense', isPresent: Boolean(profile.driverLicenseId || profile.driverLicense) },
    { name: 'certificate', isPresent: Boolean(profile.certificateId || profile.certificate) },
    { name: 'governmentIssueId', isPresent: Boolean(profile.governmentIssueIdUID || profile.governmentIssueId) },
    { name: 'marketplaceInsurance', isPresent: Boolean(profile.marketplaceInsuranceId || profile.marketplaceInsurance) },
    { name: 'additionalCertificate', isPresent: Boolean(profile.additionalCertificateId || profile.additionalCertificate) },
  ];

  const completedFieldsCount = checks.filter((c) => c.isPresent).length;
  const totalFields = checks.length;
  const missingFields = checks.filter((c) => !c.isPresent).map((c) => c.name);
  const completionPercentage = Math.round((completedFieldsCount / totalFields) * 100);
  const isProfileComplete = completionPercentage === 100;

  return {
    completionPercentage,
    isProfileComplete,
    missingFields,
    totalFields,
    completedFieldsCount,
  };
}

export function checkOverallProfileCompletion(user: any): ProfileCompletionResult {
  if (user?.userProfile) {
    return calculateUserProfileCompletion(user.userProfile);
  }
  if (user?.providerProfile) {
    return calculateProviderProfileCompletion(user.providerProfile);
  }
  return {
    completionPercentage: 0,
    isProfileComplete: false,
    missingFields: ['profile'],
    totalFields: 1,
    completedFieldsCount: 0,
  };
}
