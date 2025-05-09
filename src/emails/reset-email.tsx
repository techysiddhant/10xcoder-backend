import { Body, Button, Container, Head, Heading, Hr, Html, Link, Section, Tailwind, Text } from '@react-email/components';
interface ResetEmailProps {
  name: string;
  url: string;
}

export function ResetEmail({ name, url }: Readonly<ResetEmailProps>) {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Body className="font-sans py-[40px] ">
          <Container className="bg-white dark:bg-gray-800 rounded-[16px] mx-auto p-[48px] max-w-[500px]">
            <Section className="mb-[32px]">
              <Text className="text-[24px] font-bold text-[#f59e0b] dark:text-[#fbbf24] m-0">10xCoder.club</Text>
            </Section>
            <Section>
              <Heading className="text-[28px] font-bold text-[#111827] dark:text-white m-0 mb-[24px]">
                Reset your password
              </Heading>
              <Text className="text-[16px] leading-[24px] text-[#4b5563] dark:text-gray-300 m-0 mb-[16px]">
                Hey {name},
              </Text>
              <Text className="text-[16px] leading-[24px] text-[#4b5563] dark:text-gray-300 m-0 mb-[24px]">
                We received a request to reset your password for your 10xCoder.club account. Click the button below to create a new password:
              </Text>
              <Section className="mb-[32px] mt-4">
                <Button
                  className="bg-[#f59e0b] hover:bg-[#d97706] dark:bg-[#fbbf24] dark:hover:bg-[#f59e0b] text-white font-medium py-[12px] px-[20px] rounded-[8px] text-[14px] no-underline text-center box-border transition-colors"
                  href={url}
                >
                  Reset Password
                </Button>
              </Section>
              <Text className="text-[14px] leading-[20px] text-[#6b7280] dark:text-gray-400 m-0 mb-[16px]">
                This link will expire in 1 hour for security reasons. If you didn't request a password reset, please ignore this email or contact support if you have concerns.
              </Text>
              <Hr className="border-[#e5e7eb] dark:border-gray-700 my-[32px]" />
              <Text className="text-[14px] leading-[20px] text-[#6b7280] dark:text-gray-400 m-0">
                Security tip: Never share your password with anyone, and make sure to use a unique, strong password for your 10xCoder.club account.
              </Text>
            </Section>
            <Section className="mt-[32px] pt-[32px] border-t border-[#e5e7eb] dark:border-gray-700">
              <Text className="text-[12px] text-[#9ca3af] dark:text-gray-500 text-center m-0">
                © 2025 10xCoder.club. All rights reserved.
              </Text>
              <Text className="text-[12px] text-[#9ca3af] dark:text-gray-500 text-center m-0">
                Helping developers level up their coding skills
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
