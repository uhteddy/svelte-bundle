<script lang="ts">
  let count = $state(0);
</script>

<main>
  <h1>Hello from {{PROJECT_NAME}}!</h1>
  <p>Edit <code>src/App.svelte</code> to get started.</p>
  <button onclick={() => count++}>
    Count: {count}
  </button>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 1rem;
    font-family: system-ui, sans-serif;
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
  }

  button {
    padding: 0.5rem 1.5rem;
    font-size: 1rem;
    border-radius: 0.375rem;
    border: 1px solid #ccc;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  button:hover {
    background-color: #f0f0f0;
  }
</style>
