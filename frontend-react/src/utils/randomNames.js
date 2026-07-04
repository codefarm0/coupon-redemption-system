const names = [
  'Rahul', 'Priya', 'Neha', 'Amit', 'Sonal', 'Deepak', 'Rakesh', 'Pooja',
  'Vikram', 'Anjali', 'Suresh', 'Kavita', 'Rajesh', 'Sunita', 'Manish',
  'Divya', 'Arun', 'Meena', 'Vijay', 'Laxmi', 'Sanjay', 'Rekha', 'Akash',
  'Bhavna', 'Kiran', 'Nisha', 'Gaurav', 'Swati', 'Harsh', 'Jyoti',
  'Ankit', 'Pallavi', 'Nitin', 'Shweta', 'Rohit', 'Aarti', 'Mohit', 'Geeta',
  'Varun', 'Komal', 'Tarun', 'Preeti', 'Akshay', 'Ritu', 'Dinesh', 'Shalini',
  'Sachin', 'Sneha', 'Ravi', 'Anita', 'Prakash', 'Usha', 'Gopal', 'Nandini',
  'Manoj', 'Asha', 'Harish', 'Maya', 'Lalit', 'Radha',
];

export function generateRandomNames(count) {
  const result = [];
  for (let i = 0; i < count; i++) {
    const baseName = names[i % names.length];
    const suffix = i >= names.length ? Math.floor(i / names.length) + 1 : '';
    result.push(suffix ? `${baseName}${suffix}` : baseName);
  }
  return result.sort(() => Math.random() - 0.5);
}
