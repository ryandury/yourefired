document.addEventListener('DOMContentLoaded', async function() {
  const keywordForm = document.getElementById('keyword-form');
  const keywordInput = document.getElementById('keyword-input');
  const keywordList = document.getElementById('keyword-list');
  const revealCheckbox = document.getElementById('reveal-checkbox');

  keywordInput.focus();

  const result = await new Promise((resolve) => {
    chrome.storage.local.get(['keywords', 'revealCheckboxState'], resolve);
  });
  console.log('result', result);
  const keywords = result.keywords || ['trump'];
  revealCheckbox.checked = result.revealCheckboxState || false;

  function renderKeywords() {
    keywordList.innerHTML = '';
    keywords.forEach((keyword, index) => {
      const li = document.createElement('li');
      li.textContent = keyword;

      const deleteBtn = document.createElement('span');
      deleteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.style.marginLeft = '10px';
      deleteBtn.style.color = 'white';
      deleteBtn.style.backgroundColor = 'black';
      deleteBtn.style.borderRadius = '50%';
      deleteBtn.style.display = 'inline-flex';
      deleteBtn.style.alignItems = 'center';
      deleteBtn.style.justifyContent = 'center';
      deleteBtn.style.padding = '2px';
      deleteBtn.addEventListener('click', async function() {
        keywords.splice(index, 1);
        await new Promise((resolve) => {
          chrome.storage.local.set({ keywords: keywords }, resolve);
        });
        renderKeywords();
      });

      li.appendChild(deleteBtn);
      keywordList.appendChild(li);
    });
  }

  revealCheckbox.addEventListener('change', function() {
    chrome.storage.local.set({ revealCheckboxState: revealCheckbox.checked }, () => {
      console.log('Checkbox state saved:', revealCheckbox.checked);
    });
  });

  keywordForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const input = keywordInput.value.trim();
    if (input) {
      const newKeywords = input.split(',').map(kw => kw.trim()).filter(kw => kw && !keywords.includes(kw));
      if (newKeywords.length > 0) {
        keywords.push(...newKeywords);
        await new Promise((resolve) => {
          chrome.storage.local.set({ keywords: keywords }, resolve);
        });
        renderKeywords();
        keywordInput.value = '';
      }
    }
  });

  renderKeywords();
});