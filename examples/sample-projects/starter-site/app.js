const form = document.querySelector('#task-form');
const input = document.querySelector('#task');
const tasks = document.querySelector('#tasks');
const remaining = document.querySelector('#remaining');

function updateRemaining() {
  const count = tasks.querySelectorAll('input:not(:checked)').length;
  remaining.textContent = `${count} ${count === 1 ? 'thing' : 'things'} left`;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const label = input.value.trim();
  if (!label) return;
  const item = document.createElement('li');
  item.innerHTML = `<label><input type="checkbox" /> <span></span></label>`;
  item.querySelector('span').textContent = label;
  tasks.append(item);
  input.value = '';
  updateRemaining();
});

tasks.addEventListener('change', updateRemaining);
